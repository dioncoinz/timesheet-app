import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow the PIN page + PIN API + Next internals
  if (
    pathname.startsWith("/pin") ||
    pathname.startsWith("/api/pin") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Require cookie
  const authed = req.cookies.get("pin_ok")?.value === "1";
  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/pin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
