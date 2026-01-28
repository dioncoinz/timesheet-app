import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // ...validate pin...
  const res = NextResponse.json({ ok: true });
  res.cookies.set("pin_ok", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });
  return res;
}
