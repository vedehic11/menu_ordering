import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendStaffPinSetupEmail } from "@/lib/staff-pin-email";

export function hashStaffPinToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendStaffPinSetupLink({
  staffId,
  requestedById,
  email,
  name,
}: {
  staffId: string;
  requestedById: string;
  email: string;
  name: string;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL must be set before sending PIN setup emails.");
  }

  const setupUrl = new URL("/admin/pin/setup", appUrl);
  if (process.env.NODE_ENV === "production" && setupUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashStaffPinToken(rawToken);
  const tokenRecord = await prisma.staffPinToken.create({
    data: {
      staffId,
      requestedById,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  setupUrl.searchParams.set("token", rawToken);

  try {
    await prisma.staffPinToken.updateMany({
      where: {
        staffId,
        id: { not: tokenRecord.id },
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });
    await sendStaffPinSetupEmail({ email, name, setupUrl: setupUrl.toString() });
  } catch (error) {
    await prisma.staffPinToken.delete({ where: { id: tokenRecord.id } });
    throw error;
  }
}
