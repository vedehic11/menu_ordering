import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getStaffJwtSecret } from "@/lib/jwt-secret";

// Routes that are ALWAYS public (no auth required)
const PUBLIC_PATHS = [
  "/admin/login",
  "/api/auth/staff/login",
  "/api/auth/staff/logout",
  "/api/auth/staff/me",
  "/menu/",
  "/order/",
  "/api/menu/",
  "/api/orders",
  "/api/sessions",
  "/api/service-requests",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin") && pathname !== "/admin/login";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-admin, non-protected paths
  if (!isAdminPath(pathname)) return NextResponse.next();

  // Allow public paths through without auth
  if (isPublicPath(pathname)) return NextResponse.next();

  // Check for staff_token cookie
  const token = request.cookies.get("staff_token")?.value;

  if (!token) {
    // No token → redirect to login
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    await jwtVerify(token, getStaffJwtSecret(), {
      issuer: "restaurant-ordering",
      audience: "staff",
    });
    return NextResponse.next();
  } catch {
    // Invalid or expired token → redirect to login
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("staff_token");
    return response;
  }
}

export const config = {
  // Match all /admin/* routes except /admin/login itself
  matcher: ["/admin/:path*"],
};
