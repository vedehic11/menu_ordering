import { NextResponse } from "next/server";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json({ status: "unavailable", database: "not_configured" }, { status: 503 });
    }
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json({ status: "unavailable", database: "disconnected" }, { status: 503 });
  }
}
