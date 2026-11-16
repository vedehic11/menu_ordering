import { NextRequest, NextResponse } from "next/server";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import {
  updateSessionStatus,
  getStoredSessions,
  getServiceRequests,
  saveServiceRequests,
} from "@/lib/storage";
import { MOCK_TABLES } from "@/lib/mock-data";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const tableToken = new URL(request.url).searchParams.get("tableToken");
    if (!tableToken) {
      return NextResponse.json({ error: "A valid table QR token is required." }, { status: 401 });
    }

    // 1. PostgreSQL / Prisma path
    if (hasDatabaseUrl()) {
      try {
        const table = await prisma.diningTable.findUnique({
          where: { qrToken: tableToken, isActive: true },
          select: { id: true },
        });
        if (!table) return NextResponse.json({ error: "Table not found." }, { status: 404 });
        const result = await prisma.$transaction(async (tx) => {
          const session = await tx.tableSession.findUnique({
            where: { id: sessionId },
            include: { table: true },
          });
          if (!session || session.tableId !== table.id) {
            throw new Error("SESSION_NOT_FOUND");
          }
          if (session.status === "settled" || session.status === "cancelled") {
            throw new Error("SESSION_CLOSED");
          }

          const existingRequest = await tx.serviceRequest.findFirst({
            where: { tableId: table.id, type: "bill", status: "pending" },
          });
          if (existingRequest) {
            const updated = await tx.tableSession.update({
              where: { id: sessionId },
              data: { status: "bill_requested" },
            });
            return { updated };
          }
          const updated = await tx.tableSession.update({
            where: { id: sessionId },
            data: { status: "bill_requested" },
          });
          await tx.serviceRequest.create({
            data: {
              tableId: session.tableId,
              tableNumber: session.table.tableNumber,
              type: "bill",
              note: `Guest requested final bill for Session #${session.sessionNumber}`,
              status: "pending",
            },
          });
          return { updated };
        });

        return NextResponse.json({
          success: true,
          message: "Bill requested. Please proceed to the cashier counter.",
          session: result.updated,
        });
      } catch (err) {
        console.error("Prisma bill-request error:", err);
        if (err instanceof Error && err.message === "SESSION_NOT_FOUND") {
          return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }
        if (err instanceof Error && err.message === "SESSION_CLOSED") {
          return NextResponse.json({ error: "This table session is already closed." }, { status: 400 });
        }
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "Bill request service is temporarily unavailable." }, { status: 503 });
        }
      }
    }

    // 2. Dual-Storage / Resilient Fallback path
    const matchedTable = MOCK_TABLES.find((table) => table.qr_token === tableToken);
    if (!matchedTable) return NextResponse.json({ error: "Table not found." }, { status: 404 });
    const storedSession = getStoredSessions().find((session) => session.id === sessionId);
    if (!storedSession || storedSession.table_id !== matchedTable.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const updated = updateSessionStatus(sessionId, "bill_requested");
    if (!updated) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Add service request
    const requests = getServiceRequests();
    const newReq = {
      id: `req-${Date.now()}`,
      table_id: updated.table_id,
      table_number: updated.table_number || "Table",
      type: "bill" as const,
      note: `Guest requested final bill for Session #${updated.session_number}`,
      status: "pending" as const,
      created_at: new Date().toISOString(),
    };
    requests.unshift(newReq);
    saveServiceRequests(requests);

    return NextResponse.json({
      success: true,
      message: "Bill requested. Please proceed to the cashier counter to settle.",
      session: updated,
    });
  } catch (error) {
    console.error("Failed to request bill:", error);
    return NextResponse.json({ error: "Failed to request bill" }, { status: 500 });
  }
}
