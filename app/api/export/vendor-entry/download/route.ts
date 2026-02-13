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

async function buildWorkbook(lines: ExportLine[]) {
  const templatePath = path.join(
    process.cwd(),
    "public",
    "data",
    "Master App Timesheet.xlsx"
  );

  if (!fs.existsSync(templatePath))
    throw new Error("Template not found");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const sheet = workbook.getWorksheet("Vendor Entry Sheet");
  if (!sheet)
    throw new Error('Missing sheet "Vendor Entry Sheet" in template');

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

    [1,2,3,4,5,6,7,9,10,11].forEach(c => sheet.getCell(row,c).numFmt="@");
    row++;
  }

  const first = lines[0];
  const filename = `VendorEntry_${safeFilename(first?.company ?? "Company")}_${safeFilename(first?.dateISO ?? "date")}.xlsx`;

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return { buffer, filename };
}

export async function POST(req: Request) {
  try {
    const { lines } = await req.json();

    if (!Array.isArray(lines) || !lines.length)
      return NextResponse.json({ error: "No lines provided" }, { status: 400 });

    const { buffer, filename } = await buildWorkbook(lines);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Export failed" },
      { status: 500 }
    );
  }
}
