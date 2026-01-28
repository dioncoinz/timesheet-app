import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

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

function toDDMMYYYY(iso: string): string {
  const [y, m, d] = String(iso || "").split("-");
  if (!y || !m || !d) return String(iso || "");
  return `${d}.${m}.${y}`;
}

function asText(v: any): string {
  return v == null ? "" : String(v);
}

function asNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeFilename(s: string): string {
  return String(s).replace(/[^a-z0-9_\-\.]/gi, "_");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lines: ExportLine[] = body?.lines ?? [];

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "No lines provided" }, { status: 400 });
    }

    const templatePath = path.join(process.cwd(), "public", "data", "Master App Timesheet.xlsx");
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: "Template not found", templatePath }, { status: 500 });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const sheet = workbook.getWorksheet("Vendor Entry Sheet");
    if (!sheet) {
      return NextResponse.json(
        { error: 'Missing sheet "Vendor Entry Sheet" in template' },
        { status: 500 }
      );
    }

    let row = 4;
    for (const l of lines) {
      sheet.getCell(row, 1).value = toDDMMYYYY(asText(l.dateISO));     // A Date
      sheet.getCell(row, 2).value = asText(l.employeeName);           // B Name
      sheet.getCell(row, 3).value = asText(l.sapId);                  // C SAP ID
      sheet.getCell(row, 4).value = asText(l.serviceMasterNumber);    // D Service Master
      sheet.getCell(row, 5).value = asText(l.woNumber);               // E WO
      sheet.getCell(row, 6).value = asText(l.opNumber);               // F OP
      sheet.getCell(row, 7).value = asText(l.workCenter);             // G WC
      sheet.getCell(row, 8).value = asNumber(l.hours);                // H Hours
      sheet.getCell(row, 9).value = asText(l.poNumber);               // I PO
      sheet.getCell(row, 10).value = asText(l.poItem);                // J PO Item
      sheet.getCell(row, 11).value = asText(l.role);                  // K Role

      [1, 2, 3, 4, 5, 6, 7, 9, 10, 11].forEach((c) => (sheet.getCell(row, c).numFmt = "@"));
      row++;
    }

    const buffer = await workbook.xlsx.writeBuffer();

    const first = lines[0];
    const filename = `VendorEntry_${safeFilename(first?.company ?? "Company")}_${safeFilename(
      first?.dateISO ?? "date"
    )}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("DOWNLOAD EXPORT ERROR:", err);
    return NextResponse.json(
      { error: err?.message ?? "Download export failed" },
      { status: 500 }
    );
  }
}
