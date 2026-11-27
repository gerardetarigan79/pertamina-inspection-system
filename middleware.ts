import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "./app/lib/auth-security";
import { getAuthenticatedUser } from "./app/lib/auth";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  let user;

  try {
    // Check the database-backed session on page requests too. Account deactivation
    // and server-side session revocation therefore take effect immediately.
    user = await getAuthenticatedUser(request);
  } catch (error) {
    console.error("Page session verification failed:", error);
    return new NextResponse("Authentication service is temporarily unavailable.", { status: 503 });
  }

  if (pathname === "/login") {
    if (!user) return NextResponse.next();
    return NextResponse.redirect(new URL(user.mustChangePassword ? "/change-password" : "/", request.url));
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set({
      name: AUTH_COOKIE_NAME, value: "", httpOnly: true,
      secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: "/", maxAge: 0, expires: new Date(0),
    });
    return response;
  }

  if (user.mustChangePassword && pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }
  if (!user.mustChangePassword && pathname === "/change-password") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (pathname.startsWith("/admin") && user.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // API routes perform their own database-backed authorization checks.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
  runtime: "nodejs",
};
