import { NextRequest, NextResponse } from "next/server";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import { MOCK_TABLES } from "@/lib/mock-data";
import {
  getStoredSessions,
  getOrCreateActiveSession,
  getStoredOrders,
} from "@/lib/storage";
import { requireStaffRole } from "@/lib/auth";
import { getOrCreateActiveSession as getOrCreateDatabaseSession } from "@/lib/active-session";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tableToken = searchParams.get("tableToken");
    const tableId = searchParams.get("tableId");
    const activeOnly = searchParams.get("active") === "true";

    let staff: Awaited<ReturnType<typeof requireStaffRole>>["staff"] = null;
    if (!tableToken) {
      const auth = await requireStaffRole(request, ["captain", "cashier", "manager"]);
      staff = auth.staff;
      const { errorResponse } = auth;
      if (errorResponse) return errorResponse;
    }

    // 1. PostgreSQL / Prisma path
    if (hasDatabaseUrl()) {
      try {
        if (tableToken) {
          const table = await prisma.diningTable.findUnique({
            where: { qrToken: tableToken },
          });
          if (!table || !table.isActive) {
            return NextResponse.json({ error: "Table not found" }, { status: 404 });
          }

          const session = await prisma.$transaction(async (tx) => {
            const active = await getOrCreateDatabaseSession(tx, table.id);
            return tx.tableSession.findUniqueOrThrow({
              where: { id: active.id },
              include: {
                table: true,
                orders: {
                  include: {
                    items: true,
                    ...(staff ? { customer: true } : {}),
                  },
                  orderBy: { createdAt: "asc" },
                },
              },
            });
          });

          return NextResponse.json({
            session: {
              ...session,
              table_id: session.tableId,
              session_number: session.sessionNumber,
              guest_count: session.guestCount,
              opened_at: session.openedAt.toISOString(),
              closed_at: session.closedAt?.toISOString() ?? null,
              table: {
                ...session.table,
                table_number: session.table.tableNumber,
                qr_token: session.table.qrToken,
              },
            },
          });
        }

        // Active sessions across all tables for counter command center
        const sessions = await prisma.tableSession.findMany({
          where: {
            table: { restaurantId: staff!.restaurantId },
            ...(activeOnly ? { status: { in: ["open", "bill_requested", "closing"] } } : {}),
          },
          include: {
            table: true,
            orders: {
              include: {
                items: true,
                ...(staff ? { customer: true } : {}),
              },
              orderBy: { createdAt: "asc" },
            },
            settlement: {
              include: { payments: true },
            },
          },
          orderBy: { openedAt: "desc" },
        });

        return NextResponse.json({
          sessions: sessions.map((session) => ({
            ...session,
            table_id: session.tableId,
            session_number: session.sessionNumber,
            guest_count: session.guestCount,
            opened_at: session.openedAt.toISOString(),
            closed_at: session.closedAt?.toISOString() ?? null,
            table_number: session.table.tableNumber,
            table: {
              ...session.table,
              table_number: session.table.tableNumber,
              qr_token: session.table.qrToken,
            },
          })),
        });
      } catch (err) {
        console.error("Prisma sessions GET error:", err);
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "Table sessions are temporarily unavailable." }, { status: 503 });
        }
      }
    }

    // 2. Dual-Storage / Resilient Fallback path
    const sessions = getStoredSessions();
    const orders = getStoredOrders();

    if (tableToken) {
      const table = MOCK_TABLES.find((t) => t.qr_token === tableToken);
      if (!table) {
        return NextResponse.json({ error: "Table not found" }, { status: 404 });
      }
      const activeSession = getOrCreateActiveSession(table.id, table.table_number);
      const sessionOrders = orders.filter((o) => o.session_id === activeSession.id);

      return NextResponse.json({
        session: {
          ...activeSession,
          table_id: table.id,
          table_number: table.table_number,
          table: {
            id: table.id,
            tableNumber: table.table_number,
            table_number: table.table_number,
            qrToken: table.qr_token,
            qr_token: table.qr_token,
          },
          orders: sessionOrders.map((order) => ({ ...order, customer: undefined })),
        },
      });
    }

    if (tableId) {
      const activeSession = sessions.find(
        (s) => s.table_id === tableId && ["open", "bill_requested", "closing"].includes(s.status)
      );
      if (activeSession) {
        const sessionOrders = orders.filter((o) => o.session_id === activeSession.id);
        const table = MOCK_TABLES.find((t) => t.id === activeSession.table_id);
        return NextResponse.json({
          session: {
            ...activeSession,
            table_number: table?.table_number,
            table: table ? {
              id: table.id,
              tableNumber: table.table_number,
              table_number: table.table_number,
              qrToken: table.qr_token,
              qr_token: table.qr_token,
            } : undefined,
            orders: sessionOrders,
          },
        });
      }
      return NextResponse.json({ session: null });
    }

    // Return all or active sessions with aggregated orders
    const resultSessions = (activeOnly
      ? sessions.filter((s) => ["open", "bill_requested", "closing"].includes(s.status))
      : sessions
    ).map((sess) => {
      const table = MOCK_TABLES.find((t) => t.id === sess.table_id);
      const sessionOrders = orders.filter((o) => o.session_id === sess.id);
      return {
        ...sess,
        table_number: table?.table_number,
        table: table ? {
          id: table.id,
          tableNumber: table.table_number,
          table_number: table.table_number,
          qrToken: table.qr_token,
          qr_token: table.qr_token,
        } : undefined,
        orders: sessionOrders,
      };
    });

    return NextResponse.json({ sessions: resultSessions });
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    return NextResponse.json({ error: "Failed to fetch table sessions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { staff, errorResponse } = await requireStaffRole(request, ["captain", "manager"]);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { tableId, guestCount } = body;

    if (!tableId) {
      return NextResponse.json({ error: "tableId is required" }, { status: 400 });
    }

    // 1. PostgreSQL / Prisma path
    if (hasDatabaseUrl()) {
      try {
        const newSession = await prisma.$transaction(async (tx) => {
          const table = await tx.diningTable.findFirst({
            where: { id: tableId, restaurantId: staff?.restaurantId, isActive: true },
            select: { id: true },
          });
          if (!table) throw new Error("TABLE_NOT_FOUND");
          const active = await getOrCreateDatabaseSession(
            tx,
            table.id,
            typeof guestCount === "number" && guestCount > 0 ? guestCount : 2,
          );
          return tx.tableSession.findUniqueOrThrow({
            where: { id: active.id },
            include: { table: true, orders: true },
          });
        });

        return NextResponse.json({ session: newSession }, { status: 201 });
      } catch (err) {
        if (err instanceof Error && err.message === "TABLE_NOT_FOUND") {
          return NextResponse.json({ error: "Dining table not found." }, { status: 404 });
        }
        console.error("Prisma session POST error:", err);
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "Table session could not be opened." }, { status: 503 });
        }
      }
    }

    // 2. Fallback path
    const table = MOCK_TABLES.find((t) => t.id === tableId) || MOCK_TABLES[0];
    const session = getOrCreateActiveSession(table.id, table.table_number, guestCount || 2);

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json({ error: "Failed to open dining session" }, { status: 500 });
  }
}
