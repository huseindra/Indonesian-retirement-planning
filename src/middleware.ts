import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, SESSION_COOKIE_NAME } from "@/lib/auth/constants";

/**
 * Fast, optimistic gate: sends visitors without a session cookie to the
 * login page. The cookie is fully validated against SQLite in the
 * authenticated layout, since middleware cannot use the database driver.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.next();
  }

  const loginUrl = new URL(LOGIN_PATH, request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") {
    loginUrl.searchParams.set("next", `${pathname}${search}`);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/financial-profile/:path*",
    "/living-costs/:path*",
    "/retirement-plan/:path*",
    "/scenarios/:path*",
  ],
};
