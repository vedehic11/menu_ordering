import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import { settleSessionFile } from "@/lib/storage";
import { requireStaffRole, logAuditEvent } from "@/lib/auth";
import { calculateRestaurantTax } from "@/lib/tax";
import { getStoredOrders, getStoredSessions } from "@/lib/storage";

const paymentTenderSchema = z.object({
  tender: z.enum(["cash", "upi", "card", "other"]),
  amount_paise: z.number().int().positive("Payment amount must be greater than 0"),
  reference: z.string().optional(),
});

const settleSchema = z.object({
  payments: z.array(paymentTenderSchema).min(1, "At least one payment tender is required"),
  discountPaise: z.number().int().min(0).default(0),
  taxPaise: z.number().int().min(0).optional(),
  shiftId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate Staff Role (Only Cashier, Manager, or Owner can settle bills)
    const { staff, errorResponse } = await requireStaffRole(request, ["cashier", "manager", "owner"]);
    if (errorResponse) return errorResponse;

    const { id: sessionId } = await params;
    const rawBody = await request.json();
    const body = settleSchema.parse(rawBody);

    // 2. Strict PostgreSQL Mode with ACID Transaction
    if (hasDatabaseUrl()) {
      try {
        const result = await prisma.$transaction(
          async (tx) => {
            const session = await tx.tableSession.findUnique({
              where: { id: sessionId },
              include: {
                orders: {
                  include: { items: true },
                },
                table: true,
              },
            });

            if (!session) {
              throw new Error("SESSION_NOT_FOUND");
            }
            if (session.table.restaurantId !== staff?.restaurantId) {
              throw new Error("SESSION_NOT_FOUND");
            }

            if (session.status === "settled") {
              throw new Error("ALREADY_SETTLED");
            }

            // Calculate Subtotal from all active orders in this session
            const subtotalPaise = session.orders.reduce((sum, o) => sum + o.subtotalPaise, 0);
            if (body.discountPaise > subtotalPaise) {
              throw new Error("DISCOUNT_EXCEEDS_SUBTOTAL");
            }
            const taxableAmount = Math.max(0, subtotalPaise - body.discountPaise);

            const { cgstPaise, sgstPaise, totalPaise: taxPaise } =
              calculateRestaurantTax(taxableAmount);
            const netPayablePaise = taxableAmount + taxPaise;

            // Verify total payments
            const totalPaidPaise = body.payments.reduce((sum, p) => sum + p.amount_paise, 0);
            if (totalPaidPaise < netPayablePaise) {
              throw new Error("INSUFFICIENT_PAYMENT");
            }

            // Generate sequential Tax Invoice Number (e.g. MOM-2026-27/0042)
            const invoiceCount = await tx.settlement.count();
            const invoiceNumber = `MOM-2026-27/${String(invoiceCount + 1).padStart(4, "0")}`;

            // Create Settlement record with payment tenders
            const settlement = await tx.settlement.create({
              data: {
                sessionId: session.id,
                cashierId: staff?.staffId || null,
                shiftId: body.shiftId || null,
                invoiceNumber,
                subtotalPaise,
                discountPaise: body.discountPaise,
                taxPaise,
                cgstPaise,
                sgstPaise,
                totalPaidPaise,
                settledAt: new Date(),
                payments: {
                  create: body.payments.map((p) => ({
                    tender: p.tender,
                    amountPaise: p.amount_paise,
                    reference: p.reference || null,
                  })),
                },
              },
              include: { payments: true },
            });

            // Mark TableSession as settled & record closedAt
            const updatedSession = await tx.tableSession.update({
              where: { id: session.id },
              data: {
                status: "settled",
                closedAt: new Date(),
                closedById: staff?.staffId || null,
              },
            });

            // Resolve any open bill service requests for this table
            await tx.serviceRequest.updateMany({
              where: {
                tableId: session.tableId,
                status: "pending",
              },
              data: {
                status: "resolved",
                resolvedById: staff?.staffId || null,
              },
            });

            // Audit Log
            await tx.auditLog.create({
              data: {
                restaurantId: session.table.restaurantId,
                action: "SETTLEMENT_RECORDED",
                actorType: "staff",
                actorId: staff?.staffId || "cashier-main",
                staffName: staff?.name || "Cashier Desk",
                details: JSON.stringify({
                  invoiceNumber,
                  sessionId: session.id,
                  tableNumber: session.table.tableNumber,
                  subtotalPaise,
                  discountPaise: body.discountPaise,
                  taxPaise,
                  totalPaidPaise,
                  tenders: body.payments.map((p) => `${p.tender}: ₹${(p.amount_paise / 100).toFixed(2)}`),
                }),
              },
            });

            return { settlement, session: updatedSession, table: session.table };
          },
          { isolationLevel: "Serializable" }
        );

        return NextResponse.json({
          success: true,
          message: "Payment recorded and table closed successfully.",
          invoiceNumber: result.settlement.invoiceNumber,
          settlement: result.settlement,
          session: result.session,
        });
      } catch (txErr: unknown) {
        const message = txErr instanceof Error ? txErr.message : "";
        if (message === "SESSION_NOT_FOUND") {
          return NextResponse.json({ error: "Session not found." }, { status: 404 });
        }
        if (message === "ALREADY_SETTLED") {
          return NextResponse.json({ error: "This table session has already been settled." }, { status: 409 });
        }
        if (message === "INSUFFICIENT_PAYMENT") {
          return NextResponse.json(
            { error: "Total payment collected is less than the net bill amount." },
            { status: 422 }
          );
        }
        if (message === "DISCOUNT_EXCEEDS_SUBTOTAL") {
          return NextResponse.json(
            { error: "Discount cannot be greater than the bill subtotal." },
            { status: 422 }
          );
        }
        console.error("Prisma settlement transaction error:", txErr);
        return NextResponse.json(
          { error: "Database transaction failed. Settlement was not recorded. Please retry." },
          { status: 500 }
        );
      }
    }

    // 3. Local Offline Fallback Mode
    try {
      const storedSession = getStoredSessions().find((stored) => stored.id === sessionId);
      if (!storedSession) {
        return NextResponse.json({ error: "Table session not found." }, { status: 404 });
      }
      if (storedSession.status === "settled") {
        return NextResponse.json({ error: "This table session has already been settled." }, { status: 409 });
      }
      const subtotalPaise = getStoredOrders()
        .filter((order) => order.session_id === sessionId)
        .reduce((sum, order) => sum + order.subtotal_paise, 0);
      if (body.discountPaise > subtotalPaise) {
        return NextResponse.json(
          { error: "Discount cannot be greater than the bill subtotal." },
          { status: 422 }
        );
      }
      const taxableAmount = subtotalPaise - body.discountPaise;
      const { totalPaise: taxPaise } = calculateRestaurantTax(taxableAmount);
      const totalPaidPaise = body.payments.reduce((sum, payment) => sum + payment.amount_paise, 0);
      if (totalPaidPaise < taxableAmount + taxPaise) {
        return NextResponse.json(
          { error: "Total payment collected is less than the net bill amount." },
          { status: 422 }
        );
      }
      const { session: settledSession, settlement } = settleSessionFile(
        sessionId,
        body.payments,
        body.discountPaise,
        taxPaise,
        staff?.staffId
      );

      await logAuditEvent({
        action: "SETTLEMENT_RECORDED",
        actorId: staff?.staffId || "cashier-main",
        staffName: staff?.name || "Cashier",
        details: { sessionId, totalPaidPaise: settlement.total_paid_paise },
      });

      return NextResponse.json({
        success: true,
        message: "Payment recorded successfully and session settled.",
        invoiceNumber: `MOM-OFFLINE-${Date.now().toString().slice(-4)}`,
        session: settledSession,
        settlement,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Session not found") {
        return NextResponse.json({ error: "Table session not found" }, { status: 404 });
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid payment details" },
        { status: 400 }
      );
    }
    console.error("Settlement error:", error);
    return NextResponse.json({ error: "Failed to process settlement" }, { status: 500 });
  }
}
