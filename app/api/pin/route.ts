import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const enteredPin = String(body?.pin ?? "");
  const correctPin = process.env.APP_PIN ?? "";

  if (!enteredPin || enteredPin !== correctPin) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });

  res.cookies.set("pin_ok", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return res;
}
