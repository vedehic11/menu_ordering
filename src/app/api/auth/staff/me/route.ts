import { NextRequest, NextResponse } from "next/server";
import { getStaffFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const staff = await getStaffFromRequest(request);
  if (!staff) {
    return NextResponse.json({ authenticated: false, staff: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    staff: {
      id: staff.staffId,
      name: staff.name,
      role: staff.role,
    },
  });
}

