import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// First, cheap line of defence: send visitors without a session cookie to the login page.
// The cookie is NOT validated here. Every admin page and every server action checks it for real.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/admin/login" && !request.cookies.get("hp_admin")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: "/admin/:path*" };
