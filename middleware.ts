import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCookieCache, getSessionCookie } from "better-auth/cookies";
import {
  CLIENT_HOME,
  INTERNAL_HOME,
  isInternalApiPath,
  isInternalPath,
} from "@/lib/auth-identity";

/**
 * The edge half of D12. Prisma is unreachable here, so this decides from the
 * signed `session_data` cookie that better-auth's `cookieCache` writes. It is a
 * fast refusal, not the authority — every internal layout still calls
 * `requireInternal()`, which re-reads the database.
 */

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // better-auth's own endpoints must stay reachable to everyone.
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  const internal = isInternalPath(pathname) || isInternalApiPath(pathname);
  const isLoginPage = pathname === "/login";

  if (!internal && !isLoginPage) return NextResponse.next();

  const hasSession = !!getSessionCookie(request);

  // Anonymous. Internal routes send them to log in — they may well be staff.
  if (!hasSession) {
    if (!internal) return NextResponse.next();
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const cached = await getCookieCache(request, {
    secret: process.env.BETTER_AUTH_SECRET,
  }).catch(() => null);

  const accountType = (cached?.user as { accountType?: string } | undefined)
    ?.accountType;

  // Already signed in and asking for the login page — send them to their home.
  if (isLoginPage) {
    return NextResponse.redirect(
      new URL(accountType === "CLIENT" ? CLIENT_HOME : INTERNAL_HOME, request.url),
    );
  }

  /**
   * A client asking for an internal route is redirected to the public landing
   * page silently. If the cache is missing or unreadable we let the request
   * through — `requireInternal()` in the layout is what actually decides, and
   * failing open here only ever costs a redirect one layer later.
   */
  if (accountType === "CLIENT") {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(CLIENT_HOME, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/hr/:path*",
    "/workflow/:path*",
    "/accounts/:path*",
    "/inventory/:path*",
    "/admin/:path*",
    "/print/:path*",
    "/api/:path*",
  ],
};
