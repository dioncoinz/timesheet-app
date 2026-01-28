import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const pin = String(body?.pin ?? "").trim();

  const expected = process.env.APP_PIN?.trim();

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Server PIN not configured (APP_PIN missing)" },
      { status: 500 }
    );
  }

  if (!pin || pin !== expected) {
    return NextResponse.json({ ok: false, error: "Invalid PIN" }, { status: 401 });
  }

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
