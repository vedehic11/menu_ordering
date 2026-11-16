import { NextRequest } from "next/server";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import { getStaffJwtSecret } from "@/lib/jwt-secret";
import { StaffRole } from "@/types/database";

export interface StaffAuthPayload {
  staffId: string;
  name: string;
  role: StaffRole;
  restaurantId: string;
  authVersion: number;
}

type StaffJwtPayload = JWTPayload & Pick<StaffAuthPayload, "staffId" | "name" | "role" | "restaurantId"> & {
  authVersion?: number;
};

function isStaffRole(role: unknown): role is StaffRole {
  return ["owner", "manager", "cashier", "chef", "captain"].includes(String(role));
}

function isStaffJwtPayload(payload: JWTPayload): payload is StaffJwtPayload {
  return (
    typeof payload.staffId === "string" &&
    typeof payload.name === "string" &&
    typeof payload.restaurantId === "string" &&
    isStaffRole(payload.role) &&
    (payload.authVersion === undefined ||
      (typeof payload.authVersion === "number" && Number.isInteger(payload.authVersion) && payload.authVersion >= 0))
  );
}

export async function hashPin(pin: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pin, salt);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export async function createStaffToken(payload: StaffAuthPayload): Promise<string> {
  const member = hasDatabaseUrl()
    ? await prisma.staffMember.findUnique({
        where: { id: payload.staffId },
        select: { authVersion: true, isActive: true, role: true, restaurantId: true },
      })
    : null;
  if (
    hasDatabaseUrl() &&
    (!member ||
      !member.isActive ||
      member.role !== payload.role ||
      member.restaurantId !== payload.restaurantId)
  ) {
    throw new Error("Cannot issue a session for an inactive or missing staff account.");
  }

  return new SignJWT({ ...payload, authVersion: member?.authVersion ?? payload.authVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("restaurant-ordering")
    .setAudience("staff")
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getStaffJwtSecret());
}

export async function verifyStaffToken(token: string): Promise<StaffAuthPayload | null> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, getStaffJwtSecret(), {
      issuer: "restaurant-ordering",
      audience: "staff",
    }));
  } catch {
    return null;
  }

  if (!isStaffJwtPayload(payload)) return null;

  const authVersion = payload.authVersion ?? 0;
  if (hasDatabaseUrl()) {
    try {
      const member = await prisma.staffMember.findUnique({
        where: { id: payload.staffId },
        select: { authVersion: true, isActive: true, role: true, restaurantId: true },
      });
      if (
        !member ||
        !member.isActive ||
        member.authVersion !== authVersion ||
        member.role !== payload.role ||
        member.restaurantId !== payload.restaurantId
      ) {
        return null;
      }
    } catch (error) {
      console.error("Could not verify staff session against the database:", error);
      return null;
    }
  }

  return {
    staffId: payload.staffId,
    name: payload.name,
    restaurantId: payload.restaurantId,
    role: payload.role,
    authVersion,
  };
}

export async function getStaffFromRequest(req: NextRequest): Promise<StaffAuthPayload | null> {
  // Check cookie first
  const cookie = req.cookies.get("staff_token")?.value;
  if (cookie) {
    const payload = await verifyStaffToken(cookie);
    if (payload) return payload;
  }

  // Check Authorization Bearer header
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    return verifyStaffToken(token);
  }

  return null;
}

export async function requireStaffRole(
  req: NextRequest,
  allowedRoles: StaffRole[]
): Promise<{ staff: StaffAuthPayload | null; errorResponse?: Response }> {
  const staff = await getStaffFromRequest(req);

  if (!staff) {
    return {
      staff: null,
      errorResponse: new Response(
        JSON.stringify({ error: "Staff authentication required. Please sign in with PIN." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(staff.role) && staff.role !== "owner") {
    return {
      staff: null,
      errorResponse: new Response(
        JSON.stringify({ error: `Access denied. Requires one of: [${allowedRoles.join(", ")}]. Your role: ${staff.role}` }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  return { staff };
}

export async function logAuditEvent({
  action,
  actorType = "staff",
  actorId,
  staffName,
  details,
  ipAddress,
  restaurantId,
}: {
  action: string;
  actorType?: "staff" | "guest" | "system";
  actorId?: string;
  staffName?: string;
  details?: Record<string, unknown> | string;
  ipAddress?: string;
  restaurantId?: string;
}): Promise<void> {
  try {
    const detailString = typeof details === "object" ? JSON.stringify(details) : details;
    if (hasDatabaseUrl()) {
      const restId = restaurantId || (await prisma.restaurant.findFirst())?.id;
      if (restId) {
        await prisma.auditLog.create({
          data: {
            restaurantId: restId,
            action,
            actorType,
            actorId: actorId || null,
            staffName: staffName || null,
            ipAddress: ipAddress || null,
            details: detailString || null,
          },
        });
      }
    } else {
      console.log(`[AUDIT LOG] ${action} by ${staffName || actorId || actorType}: ${detailString}`);
    }
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
