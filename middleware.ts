import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/pin")
  ) {
    return NextResponse.next();
  }

  const authed = req.cookies.get("pin_ok")?.value === "1";
  if (authed) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/pin";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
