import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type LineIn = {
  dateISO: string;
  company: string;
  employeeName: string;
  sapId: string;
  role: string;
  hours: number;
  woNumber: string;
  opNumber: string;
  workCenter: string;
  poNumber: string;
  poItem: string;
};

function toDDMMYYYY(dateISO: string): string {
  const m = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export async function POST(req: Request) {
  try {
    const { lines } = (await req.json()) as { lines: LineIn[] };
    if (!lines?.length) {
      return NextResponse.json({ error: "No lines provided" }, { status: 400 });
    }

    // Load template
    const filePath = path.join(process.cwd(), "public", "data", "Master App Timesheet.xlsx");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);

    const wsNames = wb.getWorksheet("Names");
    const wsVendor = wb.getWorksheet("Vendor Entry Sheet");
    if (!wsNames || !wsVendor) {
      return NextResponse.json({ error: "Missing worksheets" }, { status: 400 });
    }

    // Build service master lookup (Names G/H)
    const serviceMasterByRole: Record<string, string> = {};
    wsNames.eachRow((row, i) => {
      if (i === 1) return;
      const role = String(row.getCell(7).value ?? "").toLowerCase().trim();
      const sm = String(row.getCell(8).value ?? "").trim();
      if (role && sm) serviceMasterByRole[role] = sm;
    });

    // Write rows
    let r = 5;
    for (const l of lines) {
      wsVendor.getCell(`A${r}`).value = toDDMMYYYY(l.dateISO);
      wsVendor.getCell(`B${r}`).value = l.employeeName;
      wsVendor.getCell(`C${r}`).value = l.sapId;
      wsVendor.getCell(`D${r}`).value = serviceMasterByRole[l.role.toLowerCase()] ?? "";
      wsVendor.getCell(`E${r}`).value = l.woNumber;
      wsVendor.getCell(`F${r}`).value = l.opNumber;
      wsVendor.getCell(`G${r}`).value = l.workCenter;
      wsVendor.getCell(`H${r}`).value = l.hours;
      wsVendor.getCell(`I${r}`).value = l.poNumber;
      wsVendor.getCell(`J${r}`).value = l.poItem;
      r++;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `VendorEntry_${lines[0].company}_${lines[0].dateISO}.xlsx`;

    // Send email
    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: process.env.EMAIL_TO!,
      subject: `Vendor Entry – ${lines[0].company} – ${lines[0].dateISO}`,
      text: "Vendor entry sheet attached.",
      attachments: [
        {
          filename,
          content: Buffer.from(buffer),
        },
      ],
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
