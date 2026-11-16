import { NextRequest, NextResponse } from "next/server";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import { MOCK_TABLES } from "@/lib/mock-data";
import { requireStaffRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { staff, errorResponse } = await requireStaffRole(request, ["captain", "cashier", "manager"]);
  if (errorResponse) return errorResponse;

  if (hasDatabaseUrl()) {
    try {
      const tables = await prisma.diningTable.findMany({
        where: { isActive: true, restaurantId: staff!.restaurantId },
        orderBy: { tableNumber: "asc" },
      });
      return NextResponse.json({
        tables: tables.map((table) => ({
          id: table.id,
          restaurant_id: table.restaurantId,
          table_number: table.tableNumber,
          qr_token: table.qrToken,
          is_active: table.isActive,
          created_at: table.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      console.error("Prisma tables GET error:", error);
      return NextResponse.json({ error: "Tables are temporarily unavailable." }, { status: 503 });
    }
  }

  return NextResponse.json({ tables: MOCK_TABLES });
}
