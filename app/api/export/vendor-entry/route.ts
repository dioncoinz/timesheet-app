import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lines = body?.lines || [];

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "No lines provided" }, { status: 400 });
    }

    // Load your template
    const templatePath = path.join(
      process.cwd(),
      "public",
      "templates",
      "BOOM.xlsx"
    );

    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: "Template not found", templatePath },
        { status: 500 }
      );
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const sheet = workbook.worksheets[0];

    if (!sheet) {
      return NextResponse.json({ error: "No sheet in template" }, { status: 500 });
    }

    // Example: write starting at row 2
    let row = 2;

    for (const l of lines) {
      sheet.getCell(row, 1).value = l.date;
      sheet.getCell(row, 2).value = l.employeeName;
      sheet.getCell(row, 3).value = l.role;
      sheet.getCell(row, 4).value = l.serviceMasterNumber;
      sheet.getCell(row, 5).value = l.workOrderNumber;
      sheet.getCell(row, 6).value = l.operationNumber;
      sheet.getCell(row, 7).value = l.workCenter;
      sheet.getCell(row, 8).value = l.hours;
      row++;
    }

    // 🔑 IMPORTANT: write as buffer (not JSON, not text)
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="VendorEntry_Boom_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error("EXPORT ERROR:", err);
    return NextResponse.json(
      { error: err?.message ?? "Export failed" },
      { status: 500 }
    );
  }
}
