import { NextResponse } from "next/server";
import { Resend } from "resend";
import ExcelJS from "exceljs";

import { resolveShutdownWorkbook } from "@/lib/options";
import { appendSubmissionRecord } from "@/lib/submissions";

export const runtime = "nodejs";

type ExportLine = {
  dateISO?: string;
  company?: string;
  employeeName?: string;
  sapId?: string;
  role?: string;
  serviceMasterNumber?: string;
  hours?: number | string;
  woNumber?: string;
  opNumber?: string;
  workCenter?: string;
  poNumber?: string;
  poItem?: string;
};

type EmailBody = {
  shutdown?: string;
  lines?: ExportLine[];
  to?: string;
};

function toDDMMYYYY(iso: string) {
  const [y, m, d] = String(iso || "").split("-");
  if (!y || !m || !d) return String(iso || "");
  return `${d}.${m}.${y}`;
}

function asText(v: unknown) {
  return v == null ? "" : String(v);
}

function asNumber(v: unknown) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

function safeFilename(s: string) {
  return String(s).replace(/[^a-z0-9_\-\.]/gi, "_");
}

function normalizeEmail(value: string | undefined) {
  return String(value || "").trim();
}

function maskSecret(value: string) {
  if (!value) return "(missing)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function explainEmailError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "Email failed");
  const lower = message.toLowerCase();

  if (
    lower.includes("unable to fetch data") ||
    lower.includes("could not be resolved") ||
    lower.includes("fetch failed")
  ) {
    return "Could not reach the email service from the server. Please check the internet connection, DNS/firewall settings, and try again.";
  }

  return message;
}

async function buildWorkbook(lines: ExportLine[], shutdown?: string) {
  const { filePath: templatePath } = await resolveShutdownWorkbook(shutdown);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const sheet = workbook.getWorksheet("Vendor Entry Sheet");
  if (!sheet) throw new Error('Missing sheet "Vendor Entry Sheet"');

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

    [1, 2, 3, 4, 5, 6, 7, 9, 10, 11].forEach((c) => {
      sheet.getCell(row, c).numFmt = "@";
    });

    row++;
  }

  const first = lines[0];
  const filename = `VendorEntry_${safeFilename(first?.company ?? "Company")}_${safeFilename(first?.dateISO ?? "date")}.xlsx`;
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return { filename, buffer };
}

export async function POST(req: Request) {
  try {
    const { lines, to, shutdown } = (await req.json()) as EmailBody;
    const normalizedTo = normalizeEmail(to) || normalizeEmail(process.env.EMAIL_TO);

    if (!normalizedTo) {
      return NextResponse.json(
        { error: "Missing email. Set EMAIL_TO on the server or provide a recipient." },
        { status: 400 }
      );
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "No lines provided" }, { status: 400 });
    }

    const resendKey = normalizeEmail(process.env.RESEND_API_KEY);
    if (!resendKey) {
      console.error("Missing RESEND_API_KEY");
      return NextResponse.json(
        { error: "Server missing RESEND_API_KEY" },
        { status: 500 }
      );
    }

    const emailFrom = normalizeEmail(process.env.EMAIL_FROM) || "onboarding@resend.dev";

    console.log("EMAIL REQUEST:", {
      to: normalizedTo,
      lines: lines.length,
      from: emailFrom,
      env: process.env.VERCEL_ENV,
      resendKeyPresent: Boolean(resendKey),
      resendKeyPreview: maskSecret(resendKey),
    });

    const { buffer, filename } = await buildWorkbook(lines, shutdown);
    console.log("EMAIL PAYLOAD:", {
      filename,
      attachmentBytes: buffer.length,
      attachmentBase64Length: buffer.toString("base64").length,
      company: lines[0]?.company ?? null,
      dateISO: lines[0]?.dateISO ?? null,
    });
    const resend = new Resend(resendKey);

    const result = await resend.emails.send({
      from: emailFrom,
      to: normalizedTo,
      subject: "Vendor Entry Sheet",
      html: "<p>Attached is your export.</p>",
      attachments: [{ filename, content: buffer.toString("base64") }],
    });

    console.log("RESEND RESULT:", result);

    if (result.error) {
      console.error("RESEND ERROR:", result.error);
      return NextResponse.json(
        { error: result.error.message || "Email rejected by Resend" },
        { status: 500 }
      );
    }

    try {
      await appendSubmissionRecord({
        company: asText(lines[0]?.company),
        dateISO: asText(lines[0]?.dateISO),
        emailTo: normalizedTo,
        lineCount: lines.length,
        totalHours: lines.reduce((sum, line) => sum + asNumber(line.hours), 0),
      });
    } catch (loggingError) {
      console.error("SUBMISSION LOG ERROR:", loggingError);
    }

    return NextResponse.json({
      ok: true,
      id: result.data?.id ?? null,
      filename,
    });
  } catch (err: unknown) {
    const errorMessage = explainEmailError(err);
    console.error("EMAIL ROUTE ERROR:", err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
