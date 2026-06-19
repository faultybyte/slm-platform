import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/config";

/**
 * Coarse, fast redirect for unauthenticated users hitting /dashboard/*.
 * This is a UX convenience layer only — it improves perceived speed by
 * redirecting before any page rendering starts. It is NOT the security
 * boundary: the actual auth check happens server-side in
 * dashboard/layout.tsx (and again in any route handler that calls the
 * backend), since proxy/middleware-only auth checks are not considered
 * sufficient on their own.
 */
export function proxy(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
