// Runtime validation coverage for local-only staff login credentials.
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  hasDatabaseUrl: () => false,
  prisma: {},
}));

vi.mock("@/lib/auth", () => ({
  createStaffToken: vi.fn(async () => "local-test-token"),
  logAuditEvent: vi.fn(async () => undefined),
  verifyPin: vi.fn(),
}));

import { POST } from "../src/app/api/auth/staff/login/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

function loginRequest(pin: string, role: "admin" | "kitchen", ip: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/staff/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ pin, role }),
  });
}

describe("local staff login", () => {
  it("accepts 1111 for the local Owner account in the Admin Desk", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await POST(loginRequest("1111", "admin", "203.0.113.10"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      staff: { name: "Local Owner", role: "owner" },
    });
  });

  it("does not allow the local Owner PIN to sign in to the Kitchen", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await POST(loginRequest("1111", "kitchen", "203.0.113.11"));

    expect(response.status).toBe(401);
  });

  it("does not enable the local Owner PIN in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await POST(loginRequest("1111", "admin", "203.0.113.12"));

    expect(response.status).toBe(401);
  });
});
