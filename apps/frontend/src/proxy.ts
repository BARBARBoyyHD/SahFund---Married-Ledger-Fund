import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Cookie-presence redirect — convenience only, NEVER the authorization boundary
 * (ADR-11, AGENTS §9; CVE-2025-29927 class). This file only checks that *a* session
 * cookie exists. Its signature, expiry and the caller's workspace membership are
 * verified server-side by `requireSession()` / `requireMembership()` in every page and
 * by `membershipForApi()` in every route handler, so a forged cookie gets nowhere.
 *
 * `/join` stays reachable signed-out so the pocket code can pre-fill (design D12).
 */
const SESSION_COOKIE = "better-auth.session_token";

function isProtected(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/w/") ||
    pathname.startsWith("/workspace/")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtected(pathname)) return NextResponse.next();

  // Better Auth prefixes the cookie with `__Secure-` when the deployment is https.
  const hasSession = request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes(SESSION_COOKIE));
  if (hasSession) return NextResponse.next();

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/w/:path*", "/workspace/:path*"],
};
