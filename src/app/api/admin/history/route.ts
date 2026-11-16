import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import { MOCK_TABLES } from "@/lib/mock-data";
import { getStoredOrders, getStoredSessions } from "@/lib/storage";
import { requireStaffRole } from "@/lib/auth";
import type { SessionStatus, StaffRole } from "@/types/database";

const SESSION_STATUSES: SessionStatus[] = ["open", "bill_requested", "closing", "settled", "cancelled"];
const PAGE_SIZE = 25;

function isSessionStatus(value: string): value is SessionStatus {
  return SESSION_STATUSES.includes(value as SessionStatus);
}

function parseDate(value: string | null, endOfDay = false): Date | null | undefined {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: NextRequest) {
  try {
    const { staff, errorResponse } = await requireStaffRole(request, ["cashier", "manager", "owner"] as StaffRole[]);
    if (errorResponse) return errorResponse;
    if (!staff) {
      return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const requestedPage = Number(searchParams.get("page") || "1");
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const requestedStatus = searchParams.get("status") || "all";
    const tableId = searchParams.get("tableId") || "";
    const search = (searchParams.get("search") || "").trim().slice(0, 100);
    const from = parseDate(searchParams.get("from"));
    const to = parseDate(searchParams.get("to"), true);

    if (
      (requestedStatus !== "all" && !isSessionStatus(requestedStatus)) ||
      from === undefined ||
      to === undefined ||
      (from && to && from > to)
    ) {
      return NextResponse.json({ error: "Invalid history filters." }, { status: 400 });
    }

    const hasDb = hasDatabaseUrl();
    if (hasDb) {
      const where: Prisma.TableSessionWhereInput = {
        table: { restaurantId: staff.restaurantId },
        ...(requestedStatus === "all" ? {} : { status: requestedStatus as SessionStatus }),
        ...(tableId ? { tableId } : {}),
        ...((from || to)
          ? {
              openedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { table: { tableNumber: { contains: search, mode: "insensitive" } } },
                { settlement: { invoiceNumber: { contains: search, mode: "insensitive" } } },
                {
                  orders: {
                    some: { customer: { name: { contains: search, mode: "insensitive" } } },
                  },
                },
              ],
            }
          : {}),
      };

      try {
        const [total, sessions, tables] = await Promise.all([
          prisma.tableSession.count({ where }),
          prisma.tableSession.findMany({
            where,
            include: {
              table: { select: { tableNumber: true } },
              orders: {
                include: {
                  items: { orderBy: { createdAt: "asc" } },
                  customer: { select: { name: true } },
                },
                orderBy: { createdAt: "asc" },
              },
              settlement: { include: { payments: { orderBy: { receivedAt: "asc" } } } },
            },
            orderBy: [{ openedAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
          }),
          prisma.diningTable.findMany({
            where: { restaurantId: staff.restaurantId },
            select: { id: true, tableNumber: true },
            orderBy: { tableNumber: "asc" },
          }),
        ]);

        return NextResponse.json({
          sessions: sessions.map((session) => ({
            id: session.id,
            table_id: session.tableId,
            table_number: session.table.tableNumber,
            session_number: session.sessionNumber,
            status: session.status,
            guest_count: session.guestCount,
            opened_at: session.openedAt.toISOString(),
            closed_at: session.closedAt?.toISOString() ?? null,
            orders: session.orders.map((order) => ({
              id: order.id,
              order_number: order.orderNumber,
              kitchen_status: order.kitchenStatus,
              subtotal_paise: order.subtotalPaise,
              tax_paise: order.taxPaise,
              total_paise: order.totalPaise,
              created_at: order.createdAt.toISOString(),
              customer_name: order.customer.name,
              items: order.items.map((item) => ({
                id: item.id,
                item_name: item.itemName,
                quantity: item.quantity,
                unit_price_paise: item.unitPricePaise,
                line_total_paise: item.lineTotalPaise,
                is_voided: item.isVoided,
                void_reason: item.voidReason,
              })),
            })),
            settlement: session.settlement
              ? {
                  invoice_number: session.settlement.invoiceNumber,
                  subtotal_paise: session.settlement.subtotalPaise,
                  discount_paise: session.settlement.discountPaise,
                  tax_paise: session.settlement.taxPaise,
                  total_paid_paise: session.settlement.totalPaidPaise,
                  settled_at: session.settlement.settledAt.toISOString(),
                  payments: session.settlement.payments.map((payment) => ({
                    tender: payment.tender,
                    amount_paise: payment.amountPaise,
                    reference: payment.reference,
                    received_at: payment.receivedAt.toISOString(),
                  })),
                }
              : null,
          })),
          tables: tables.map((table) => ({ id: table.id, table_number: table.tableNumber })),
          page,
          pageSize: PAGE_SIZE,
          total,
          totalPages: Math.ceil(total / PAGE_SIZE),
        });
      } catch (error) {
        console.error("Could not load admin history from PostgreSQL:", error);
        return NextResponse.json({ error: "Visit history is temporarily unavailable." }, { status: 503 });
      }
    }

    const storedSessions = getStoredSessions();
    const tables = MOCK_TABLES.map((table) => ({ id: table.id, table_number: table.table_number }));
    for (const session of storedSessions) {
      if (!tables.some((table) => table.id === session.table_id)) {
        tables.push({
          id: session.table_id,
          table_number: session.table_number || "Former table",
        });
      }
    }
    if (tableId && !tables.some((table) => table.id === tableId)) {
      return NextResponse.json({ error: "Table not found." }, { status: 404 });
    }

    const tableNumbers = new Map(tables.map((table) => [table.id, table.table_number]));
    const orders = getStoredOrders();
    const allSessions = storedSessions
      .map((session) => ({
        ...session,
        table_number: tableNumbers.get(session.table_id) || session.table_number || "Unknown table",
        orders: orders.filter((order) => order.session_id === session.id).map((order) => ({
          id: order.id,
          order_number: order.order_number,
          kitchen_status: order.kitchen_status,
          subtotal_paise: order.subtotal_paise,
          tax_paise: order.tax_paise,
          total_paise: order.total_paise,
          created_at: order.created_at,
          customer_name: order.customer?.name || "",
          items: (order.items || []).map((item) => ({
            id: item.id,
            item_name: item.item_name,
            quantity: item.quantity,
            unit_price_paise: item.unit_price_paise,
            line_total_paise: item.line_total_paise,
            is_voided: item.is_voided ?? false,
            void_reason: item.void_reason ?? null,
          })),
        })),
        settlement: session.settlement
          ? {
              invoice_number: null,
              subtotal_paise: session.settlement.subtotal_paise,
              discount_paise: session.settlement.discount_paise,
              tax_paise: session.settlement.tax_paise,
              total_paid_paise: session.settlement.total_paid_paise,
              settled_at: session.settlement.settled_at,
              payments: session.settlement.payments.map((payment) => ({
                tender: payment.tender,
                amount_paise: payment.amount_paise,
                reference: payment.reference ?? null,
                received_at: payment.received_at,
              })),
            }
          : null,
      }))
      .filter((session) => {
        const openedAt = new Date(session.opened_at);
        return (
          (requestedStatus === "all" || session.status === requestedStatus) &&
          (!tableId || session.table_id === tableId) &&
          (!from || openedAt >= from) &&
          (!to || openedAt <= to) &&
          (!search ||
            session.table_number.toLowerCase().includes(search.toLowerCase()) ||
            session.orders.some((order) => order.customer_name.toLowerCase().includes(search.toLowerCase())))
        );
      })
      .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());
    const start = (page - 1) * PAGE_SIZE;

    return NextResponse.json({
      sessions: allSessions.slice(start, start + PAGE_SIZE),
      tables,
      page,
      pageSize: PAGE_SIZE,
      total: allSessions.length,
      totalPages: Math.ceil(allSessions.length / PAGE_SIZE),
    });
  } catch (error) {
    console.error("Failed to load admin history:", error);
    return NextResponse.json({ error: "Failed to load visit history." }, { status: 500 });
  }
}
