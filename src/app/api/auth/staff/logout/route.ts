import { NextRequest, NextResponse } from "next/server";
import { getStaffFromRequest, logAuditEvent } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const staff = await getStaffFromRequest(request);
  if (staff) {
    await logAuditEvent({
      action: "STAFF_LOGOUT",
      actorId: staff.staffId,
      staffName: staff.name,
      details: { role: staff.role },
    });
  }

  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.delete("staff_token");
  return response;
}

