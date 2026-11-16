import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import { createStaffToken, verifyPin, logAuditEvent } from "@/lib/auth";
import { StaffRole } from "@/types/database";

const loginSchema = z.object({
  pin: z.string().min(4, "PIN must be at least 4 digits").max(8),
  role: z.enum(["admin", "kitchen"]).optional(),
});

// Local-only credentials for development without a configured database.
const LOCAL_STAFF = [
  { id: "staff-mgr", name: "Local Manager", role: "manager" as StaffRole, pin: "1234" },
  { id: "staff-csh", name: "Local Cashier", role: "cashier" as StaffRole, pin: "2345" },
  { id: "staff-chf", name: "Local Chef", role: "chef" as StaffRole, pin: "3456" },
  { id: "staff-cpt", name: "Local Captain", role: "captain" as StaffRole, pin: "4567" },
  { id: "staff-own", name: "Local Owner", role: "owner" as StaffRole, pin: "1111" },
];

const PORTAL_ROLES: Record<"admin" | "kitchen", StaffRole[]> = {
  admin: ["owner", "manager", "cashier"],
  kitchen: ["chef"],
};

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const loginAttempts = new Map<string, { failures: number; windowStart: number; blockedUntil: number }>();

export async function POST(request: NextRequest) {
  try {
    const remoteAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const now = Date.now();
    const attempt = loginAttempts.get(remoteAddress);
    if (attempt && attempt.blockedUntil > now) {
      return NextResponse.json(
        { error: "Too many failed sign-in attempts. Try again in 15 minutes." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((attempt.blockedUntil - now) / 1000)) } }
      );
    }

    const rawBody = await request.json();
    const body = loginSchema.parse(rawBody);

    let databaseConfigured = false;
    try {
      databaseConfigured = hasDatabaseUrl();
    } catch (err) {
      console.error("Staff login database configuration error:", err);
      return NextResponse.json(
        { error: "Staff authentication is temporarily unavailable." },
        { status: 503 }
      );
    }

    let authenticatedStaff: {
      id: string;
      name: string;
      role: StaffRole;
      restaurantId: string;
    } | null = null;
    const allowedRoles = body.role ? PORTAL_ROLES[body.role] : undefined;

    if (databaseConfigured) {
      try {
        const staffMembers = await prisma.staffMember.findMany({
          where: {
            isActive: true,
            ...(allowedRoles ? { role: { in: allowedRoles } } : {}),
          },
        });
        const matchingStaff = [];

        for (const member of staffMembers) {
          const isMatch = await verifyPin(body.pin, member.pinHash);
          if (isMatch) {
            matchingStaff.push({
              id: member.id,
              name: member.name,
              role: member.role as StaffRole,
              restaurantId: member.restaurantId,
            });
          }
        }

        if (matchingStaff.length > 1) {
          return NextResponse.json(
            { error: "This PIN is assigned to multiple staff accounts. Ask an admin to reset your PIN." },
            { status: 409 },
          );
        }
        if (matchingStaff.length === 1) {
          authenticatedStaff = matchingStaff[0];
          await prisma.staffMember.update({
            where: { id: authenticatedStaff.id },
            data: { lastLoginAt: new Date() },
          });
        }
      } catch (err) {
        console.error("Database staff login error:", err);
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json(
            { error: "Staff authentication is temporarily unavailable." },
            { status: 503 }
          );
        }
      }
    }

    if (!authenticatedStaff && process.env.NODE_ENV !== "production") {
      const match = LOCAL_STAFF.find(
        (s) => s.pin === body.pin && (!allowedRoles || allowedRoles.includes(s.role))
      );
      if (match) {
        authenticatedStaff = {
          id: match.id,
          name: match.name,
          role: match.role,
          restaurantId: "rest-my-oh-my",
        };
      }
    }

    if (!authenticatedStaff) {
      const current = loginAttempts.get(remoteAddress);
      const failures =
        current && now - current.windowStart < LOGIN_WINDOW_MS ? current.failures + 1 : 1;
      loginAttempts.set(remoteAddress, {
        failures,
        windowStart: current && now - current.windowStart < LOGIN_WINDOW_MS ? current.windowStart : now,
        blockedUntil: failures >= MAX_FAILED_LOGINS ? now + LOGIN_WINDOW_MS : 0,
      });
      return NextResponse.json(
        { error: "Invalid staff PIN or credentials." },
        { status: 401 }
      );
    }
    loginAttempts.delete(remoteAddress);

    const token = await createStaffToken({
      staffId: authenticatedStaff.id,
      name: authenticatedStaff.name,
      role: authenticatedStaff.role,
      restaurantId: authenticatedStaff.restaurantId,
      authVersion: 0,
    });

    await logAuditEvent({
      action: "STAFF_LOGIN",
      actorId: authenticatedStaff.id,
      staffName: authenticatedStaff.name,
      details: { role: authenticatedStaff.role },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    const response = NextResponse.json({
      success: true,
      staff: {
        id: authenticatedStaff.id,
        name: authenticatedStaff.name,
        role: authenticatedStaff.role,
      },
      token,
    });

    response.cookies.set("staff_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 12 * 60 * 60, // 12 hours
      path: "/",
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
