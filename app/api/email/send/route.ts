// app/api/email/send/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, subject, message } = body;

    if (!to) {
      return NextResponse.json({ ok: false, error: "Missing 'to' email" }, { status: 400 });
    }

    // TODO: send email here (Resend / Nodemailer / etc)

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
