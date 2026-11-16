import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import { hashPin, logAuditEvent, requireStaffRole } from "@/lib/auth";
import { sendStaffPinSetupLink } from "@/lib/staff-pin-token";

const createStaffSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  role: z.enum(["manager", "cashier", "chef"]),
});

const updateStaffSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send-pin-setup"),
    staffId: z.string().min(1),
  }),
  z.object({
    action: z.literal("set-active"),
    staffId: z.string().min(1),
    isActive: z.boolean(),
  }),
]);

async function authorize(request: NextRequest) {
  const result = await requireStaffRole(request, ["owner", "manager"]);
  if (result.errorResponse) return { errorResponse: result.errorResponse };
  if (!result.staff) {
    return {
      errorResponse: NextResponse.json({ error: "Admin access required." }, { status: 401 }),
    };
  }
  let databaseConfigured = false;
  try {
    databaseConfigured = hasDatabaseUrl();
  } catch (error) {
    console.error("Staff management database configuration is invalid:", error);
  }
  if (!databaseConfigured) {
    return {
      errorResponse: NextResponse.json(
        { error: "Staff account management requires a configured PostgreSQL database." },
        { status: 503 },
      ),
    };
  }
  return { staff: result.staff };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if (auth.errorResponse) return auth.errorResponse;

    const staffMembers = await prisma.staffMember.findMany({
      where: { restaurantId: auth.staff!.restaurantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({
      actor: {
        id: auth.staff!.staffId,
        canManageOwners: auth.staff!.role === "owner",
      },
      staff: staffMembers.map((member) => ({
        ...member,
        last_login_at: member.lastLoginAt?.toISOString() ?? null,
        created_at: member.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to list staff members:", error);
    return NextResponse.json({ error: "Staff accounts are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if (auth.errorResponse) return auth.errorResponse;

    const body = createStaffSchema.parse(await request.json());
    const email = body.email.toLowerCase();
    const existing = await prisma.staffMember.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "A staff account already uses this email address." }, { status: 409 });
    }

    const randomInitialPin = randomBytes(32).toString("hex");
    const member = await prisma.staffMember.create({
      data: {
        restaurantId: auth.staff!.restaurantId,
        name: body.name,
        email,
        role: body.role,
        pinHash: await hashPin(randomInitialPin),
      },
      select: { id: true, name: true, email: true, role: true },
    });

    try {
      await sendStaffPinSetupLink({
        staffId: member.id,
        requestedById: auth.staff!.staffId,
        email,
        name: body.name,
      });
    } catch (error) {
      console.error("Could not send staff invitation email:", error);
      await prisma.staffMember.delete({ where: { id: member.id } });
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not send the staff invitation." },
        { status: 503 },
      );
    }

    await logAuditEvent({
      action: "STAFF_INVITED",
      actorId: auth.staff!.staffId,
      staffName: auth.staff!.name,
      restaurantId: auth.staff!.restaurantId,
      details: { staffId: member.id, role: member.role },
    });

    return NextResponse.json({ success: true, staff: member }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    console.error("Failed to create staff member:", error);
    return NextResponse.json({ error: "Could not create the staff account." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if (auth.errorResponse) return auth.errorResponse;

    const body = updateStaffSchema.parse(await request.json());
    const member = await prisma.staffMember.findFirst({
      where: { id: body.staffId, restaurantId: auth.staff!.restaurantId },
    });
    if (!member) {
      return NextResponse.json({ error: "Staff account not found." }, { status: 404 });
    }

    if (body.action === "send-pin-setup") {
      if (member.role === "owner" && auth.staff!.role !== "owner") {
        return NextResponse.json({ error: "Only an owner can send another owner's PIN reset link." }, { status: 403 });
      }
      if (!member.email) {
        return NextResponse.json({ error: "Add an email address before resetting this staff PIN." }, { status: 409 });
      }
      if (!member.isActive) {
        return NextResponse.json({ error: "Activate this staff account before sending a PIN reset." }, { status: 409 });
      }

      try {
        await sendStaffPinSetupLink({
          staffId: member.id,
          requestedById: auth.staff!.staffId,
          email: member.email,
          name: member.name,
        });
      } catch (error) {
        console.error("Could not send staff PIN reset email:", error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Could not send the PIN reset email." },
          { status: 503 },
        );
      }
      await logAuditEvent({
        action: "STAFF_PIN_RESET_REQUESTED",
        actorId: auth.staff!.staffId,
        staffName: auth.staff!.name,
        restaurantId: auth.staff!.restaurantId,
        details: { staffId: member.id },
      });
      return NextResponse.json({ success: true });
    }

    if (!body.isActive && member.id === auth.staff!.staffId) {
      return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 409 });
    }
    if (member.role === "owner" && auth.staff!.role !== "owner") {
      return NextResponse.json({ error: "Only an owner can change another owner's account." }, { status: 403 });
    }
    if (!body.isActive && member.role === "owner") {
      const activeOwners = await prisma.staffMember.count({
        where: { restaurantId: auth.staff!.restaurantId, role: "owner", isActive: true },
      });
      if (activeOwners <= 1) {
        return NextResponse.json({ error: "At least one active owner account is required." }, { status: 409 });
      }
    }

    await prisma.staffMember.update({
      where: { id: member.id },
      data: { isActive: body.isActive, authVersion: { increment: 1 } },
    });
    await logAuditEvent({
      action: body.isActive ? "STAFF_ACTIVATED" : "STAFF_DEACTIVATED",
      actorId: auth.staff!.staffId,
      staffName: auth.staff!.name,
      restaurantId: auth.staff!.restaurantId,
      details: { staffId: member.id, role: member.role },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    console.error("Failed to update staff account:", error);
    return NextResponse.json({ error: "Could not update the staff account." }, { status: 500 });
  }
}
