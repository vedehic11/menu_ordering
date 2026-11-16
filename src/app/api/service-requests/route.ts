import { NextRequest, NextResponse } from "next/server";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import { getServiceRequests, saveServiceRequests, ServiceRequest } from "@/lib/storage";
import { MOCK_TABLES } from "@/lib/mock-data";
import { requireStaffRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { staff, errorResponse } = await requireStaffRole(request, ["captain", "cashier", "manager"]);
    if (errorResponse) return errorResponse;

    if (hasDatabaseUrl()) {
      try {
        const requests = await prisma.serviceRequest.findMany({
          where: { table: { restaurantId: staff!.restaurantId } },
          orderBy: { createdAt: "desc" },
        });
        return NextResponse.json({
          requests: requests.map((r) => ({
            id: r.id,
            table_id: r.tableId,
            table_number: r.tableNumber,
            type: r.type,
            note: r.note,
            status: r.status,
            created_at: r.createdAt.toISOString(),
          })),
        });
      } catch (err) {
        console.error("Prisma service requests GET error:", err);
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "Service queue is temporarily unavailable." }, { status: 503 });
        }
      }
    }

    const requests = getServiceRequests();
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Error retrieving service requests:", error);
    return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tableToken, type, note } = body;

    if (hasDatabaseUrl()) {
      try {
        const table = await prisma.diningTable.findUnique({
          where: { qrToken: tableToken, isActive: true },
        });

        if (table) {
          const newRequest = await prisma.serviceRequest.create({
            data: {
              tableId: table.id,
              tableNumber: table.tableNumber,
              type: type || "waiter",
              note: note || null,
              status: "pending",
            },
          });
          return NextResponse.json({
            success: true,
            request: {
              ...newRequest,
              table_number: newRequest.tableNumber,
              created_at: newRequest.createdAt.toISOString(),
            },
          }, { status: 201 });
        }
        return NextResponse.json({ error: "Table not found." }, { status: 404 });
      } catch (err) {
        console.error("Prisma service request create error:", err);
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "Service request could not be saved." }, { status: 503 });
        }
      }
    }

    const matchedTable = MOCK_TABLES.find((t) => t.qr_token === tableToken);
    if (!matchedTable) {
      return NextResponse.json({ error: "Table not found." }, { status: 404 });
    }

    const newRequest: ServiceRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      table_id: matchedTable.id,
      table_number: matchedTable.table_number,
      type: type || 'waiter',
      note: note || undefined,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const requests = getServiceRequests();
    requests.unshift(newRequest);
    saveServiceRequests(requests);

    return NextResponse.json({ success: true, request: newRequest }, { status: 201 });
  } catch (error) {
    console.error("Error creating service request:", error);
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { staff, errorResponse } = await requireStaffRole(request, ["captain", "cashier", "manager"]);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ error: "Request ID required" }, { status: 400 });
    }

    if (hasDatabaseUrl()) {
      try {
        const result = await prisma.serviceRequest.updateMany({
          where: { id, table: { restaurantId: staff!.restaurantId } },
          data: { status: status || "resolved" },
        });
        if (!result.count) return NextResponse.json({ error: "Service request not found" }, { status: 404 });
        const updated = await prisma.serviceRequest.findFirst({
          where: { id, table: { restaurantId: staff!.restaurantId } },
        });
        return NextResponse.json({ success: true, request: updated });
      } catch (err) {
        console.error("Prisma update service request error:", err);
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "Service queue is temporarily unavailable." }, { status: 503 });
        }
      }
    }

    const requests = getServiceRequests();
    const index = requests.findIndex((r) => r.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Service request not found" }, { status: 404 });
    }

    requests[index].status = status || 'resolved';
    saveServiceRequests(requests);

    return NextResponse.json({ success: true, request: requests[index] });
  } catch (error) {
    console.error("Error updating service request:", error);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}
