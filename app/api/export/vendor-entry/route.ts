import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Resend } from "resend";

import { resolveShutdownWorkbook } from "@/lib/options";
import { appendSubmissionRecord } from "@/lib/submissions";

export const runtime = "nodejs";

type ExportLine = {
  dateISO: string;
  company: string;

  employeeName: string;
  sapId: string;
  role: string;
  serviceMasterNumber: string;

  hours: number;

  woNumber: string;
  opNumber: string;
  workCenter: string;

  poNumber: string;
  poItem: string;
};

type Body = {
  mode: "download" | "email";
  to?: string;
  shutdown?: string;
  lines: ExportLine[];
};

function toDDMMYYYY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return String(iso);
  return `${d}.${m}.${y}`;
}

function asText(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeFilename(s: string): string {
  return String(s).replace(/[^a-z0-9_\-\.]/gi, "_");
}

async function buildVendorEntryXlsx(lines: ExportLine[], shutdown?: string) {
  const { filePath: templatePath } = await resolveShutdownWorkbook(shutdown);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const sheet = workbook.getWorksheet("Vendor Entry Sheet");
  if (!sheet) {
    return {
      ok: false as const,
      error: 'Missing sheet "Vendor Entry Sheet" in template',
    };
  }

  let row = 4;
  for (const l of lines) {
    sheet.getCell(row, 1).value = toDDMMYYYY(asText(l.dateISO));
    sheet.getCell(row, 2).value = asText(l.employeeName);
    sheet.getCell(row, 3).value = asText(l.sapId);
    sheet.getCell(row, 4).value = asText(l.serviceMasterNumber);
    sheet.getCell(row, 5).value = asText(l.woNumber);
    sheet.getCell(row, 6).value = asText(l.opNumber);
    sheet.getCell(row, 7).value = asText(l.workCenter);
    sheet.getCell(row, 8).value = asNumber(l.hours);
    sheet.getCell(row, 9).value = asText(l.poNumber);
    sheet.getCell(row, 10).value = asText(l.poItem);
    sheet.getCell(row, 11).value = asText(l.role);

    [1, 2, 3, 4, 5, 6, 7, 9, 10, 11].forEach(
      (c) => (sheet.getCell(row, c).numFmt = "@")
    );
    row++;
  }

  const first = lines[0];
  const filename = `VendorEntry_${safeFilename(first?.company ?? "Company")}_${safeFilename(
    first?.dateISO ?? "date"
  )}.xlsx`;

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return { ok: true as const, buffer, filename };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const mode = body?.mode;
    const lines = body?.lines ?? [];

    if (mode !== "download" && mode !== "email") {
      return NextResponse.json(
        { ok: false, error: "Invalid mode. Use 'download' or 'email'." },
        { status: 400 }
      );
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ ok: false, error: "No lines provided" }, { status: 400 });
    }

    const built = await buildVendorEntryXlsx(lines, body?.shutdown);
    if (!built.ok) {
      return NextResponse.json({ ok: false, error: built.error }, { status: 500 });
    }

    if (mode === "download") {
      return new NextResponse(built.buffer, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${built.filename}"`,
        },
      });
    }

    const to = body?.to;
    if (!to) {
      return NextResponse.json({ ok: false, error: "Missing 'to' email" }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!resendKey) {
      return NextResponse.json({ ok: false, error: "Missing RESEND_API_KEY env var" }, { status: 500 });
    }
    if (!from) {
      return NextResponse.json({ ok: false, error: "Missing EMAIL_FROM env var" }, { status: 500 });
    }

    const resend = new Resend(resendKey);

    await resend.emails.send({
      from,
      to,
      subject: `Vendor Entry Sheet - ${lines[0]?.company ?? ""}`,
      html: `<p>Attached is the Vendor Entry export.</p>`,
      attachments: [
        {
          filename: built.filename,
          content: built.buffer.toString("base64"),
        },
      ],
    });

    await appendSubmissionRecord({
      company: lines[0]?.company ?? "",
      dateISO: lines[0]?.dateISO ?? "",
      emailTo: to,
      lineCount: lines.length,
      totalHours: lines.reduce((sum, line) => sum + asNumber(line.hours), 0),
    });

    return NextResponse.json({ ok: true, filename: built.filename });
  } catch (err: unknown) {
    console.error("VENDOR ENTRY EXPORT ERROR:", err);
    const error = err instanceof Error ? err.message : "Vendor entry export failed";

    return NextResponse.json(
      { ok: false, error },
      { status: 500 }
    );
  }
}
