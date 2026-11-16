import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import { logAuditEvent, hashPin, verifyPin } from "@/lib/auth";
import { hashStaffPinToken } from "@/lib/staff-pin-token";

function isNonSequentialPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return false;
  return !["0123456789", "9876543210"].some((sequence) => sequence.includes(pin));
}

const setupSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i, "Invalid or expired PIN setup link."),
  pin: z.string().regex(/^\d{6,8}$/).refine(isNonSequentialPin, "PIN must not be a simple sequence or repeated digit."),
});

export async function POST(request: NextRequest) {
  let databaseConfigured = false;
  try {
    databaseConfigured = hasDatabaseUrl();
  } catch (error) {
    console.error("PIN setup database configuration error:", error);
    return NextResponse.json({ error: "PIN setup requires a configured PostgreSQL database." }, { status: 503 });
  }
  if (!databaseConfigured) {
    return NextResponse.json({ error: "PIN setup requires a configured PostgreSQL database." }, { status: 503 });
  }

  try {
    const body = setupSchema.parse(await request.json());
    const now = new Date();
    const token = await prisma.staffPinToken.findUnique({
      where: { tokenHash: hashStaffPinToken(body.token) },
      include: { staff: true },
    });

    if (!token || token.usedAt || token.expiresAt <= now || !token.staff.isActive) {
      return NextResponse.json({ error: "This PIN setup link is invalid or expired. Ask an admin to send a new one." }, { status: 410 });
    }

    const otherStaff = await prisma.staffMember.findMany({
      where: { id: { not: token.staffId } },
      select: { pinHash: true },
    });
    for (const member of otherStaff) {
      if (await verifyPin(body.pin, member.pinHash)) {
        return NextResponse.json(
          { error: "That PIN is already assigned to another staff member. Choose a different PIN." },
          { status: 409 },
        );
      }
    }

    const pinHash = await hashPin(body.pin);
    const changed = await prisma.$transaction(async (tx) => {
      const consumed = await tx.staffPinToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) return false;

      await tx.staffMember.update({
        where: { id: token.staffId, isActive: true },
        data: { pinHash, authVersion: { increment: 1 } },
      });
      await tx.staffPinToken.updateMany({
        where: { staffId: token.staffId, id: { not: token.id }, usedAt: null },
        data: { usedAt: now },
      });
      return true;
    });

    if (!changed) {
      return NextResponse.json({ error: "This PIN setup link has already been used. Ask an admin to send a new one." }, { status: 410 });
    }

    await logAuditEvent({
      action: "STAFF_PIN_SET",
      actorId: token.staffId,
      staffName: token.staff.name,
      restaurantId: token.staff.restaurantId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    console.error("Failed to set staff PIN:", error);
    return NextResponse.json({ error: "PIN setup is temporarily unavailable." }, { status: 503 });
  }
}
