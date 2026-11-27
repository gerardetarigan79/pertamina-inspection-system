import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionCookie } from "./app/lib/auth-security";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = verifySessionCookie(sessionCookie, process.env.AUTH_SECRET ?? "");

  if (pathname === "/login") {
    if (!session) return NextResponse.next();
    return NextResponse.redirect(new URL(
      session.mustChangePassword ? "/change-password" : "/",
      request.url,
    ));
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.mustChangePassword && pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  if (!session.mustChangePassword && pathname === "/change-password") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // API handlers perform database-backed checks themselves. This middleware
  // provides fast page redirects using only the signed, expiring cookie.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
  runtime: "nodejs",
};
