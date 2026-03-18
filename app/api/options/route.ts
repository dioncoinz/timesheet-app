import { NextResponse } from "next/server";

import { readWorkbookOptions, resolveShutdownWorkbook } from "@/lib/options";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const shutdown = searchParams.get("shutdown") ?? undefined;

    const [{ shutdowns, selectedShutdown }, workbookOptions] = await Promise.all([
      resolveShutdownWorkbook(shutdown),
      readWorkbookOptions(shutdown),
    ]);

    return NextResponse.json({
      ok: true,
      source: "excel",
      shutdowns,
      selectedShutdown: selectedShutdown.id,
      ...workbookOptions,
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : "Failed to load options from Excel";

    return NextResponse.json(
      { ok: false, error },
      { status: 500 }
    );
  }
}
