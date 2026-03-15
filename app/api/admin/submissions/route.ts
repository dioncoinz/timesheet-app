import { NextResponse } from "next/server";

import { hasPinSession } from "@/lib/auth";
import { readSubmissionRecords } from "@/lib/submissions";

export const runtime = "nodejs";

export async function GET() {
  const authed = await hasPinSession();
  if (!authed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const submissions = await readSubmissionRecords();
  return NextResponse.json({ ok: true, submissions });
}
