// app/api/email/send/route.ts
import { NextResponse } from "next/server";

type EmailBody = {
  to?: string;
  subject?: string;
  message?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EmailBody;
    const { to } = body;

    if (!to) {
      return NextResponse.json({ ok: false, error: "Missing 'to' email" }, { status: 400 });
    }

    // TODO: send email here (Resend / Nodemailer / etc)

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json(
      { ok: false, error },
      { status: 500 }
    );
  }
}
