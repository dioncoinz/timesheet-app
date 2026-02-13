import { NextResponse } from "next/server";
import { Resend } from "resend";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

function toDDMMYYYY(iso: string) {
const [y, m, d] = String(iso || "").split("-");
if (!y || !m || !d) return String(iso || "");
return `${d}.${m}.${y}`;
}

const asText = (v: any) => (v == null ? "" : String(v));
const asNumber = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const safeFilename = (s: string) =>
String(s).replace(/[^a-z0-9_\-\.]/gi, "_");

async function buildWorkbook(lines: any[]) {
const templatePath = path.join(
process.cwd(),
"public",
"data",
"Master App Timesheet.xlsx"
);

if (!fs.existsSync(templatePath)) {
throw new Error(`Template not found at ${templatePath}`);
}

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

```
[1, 2, 3, 4, 5, 6, 7, 9, 10, 11].forEach(
  (c) => (sheet.getCell(row, c).numFmt = "@")
);

row++;
```

}

const first = lines[0];

const filename = `VendorEntry_${safeFilename(     first?.company ?? "Company"   )}_${safeFilename(first?.dateISO ?? "date")}.xlsx`;

const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

return { filename, buffer };
}

export async function POST(req: Request) {
try {
const { lines, to } = await req.json();

```
if (!to)
  return NextResponse.json({ error: "Missing email" }, { status: 400 });

if (!Array.isArray(lines) || lines.length === 0)
  return NextResponse.json({ error: "No lines provided" }, { status: 400 });

if (!process.env.RESEND_API_KEY) {
  console.error("Missing RESEND_API_KEY");
  return NextResponse.json(
    { error: "Server missing RESEND_API_KEY" },
    { status: 500 }
  );
}

const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

console.log("EMAIL REQUEST:", {
  to,
  lines: lines.length,
  from: EMAIL_FROM,
  env: process.env.VERCEL_ENV,
});

const { buffer, filename } = await buildWorkbook(lines);

const resend = new Resend(process.env.RESEND_API_KEY);

const result = await resend.emails.send({
  from: EMAIL_FROM,
  to,
  subject: "Vendor Entry Sheet",
  html: "<p>Attached is your export.</p>",
  attachments: [{ filename, content: buffer.toString("base64") }],
});

console.log("RESEND RESULT:", result);

const anyResult = result as any;

if (anyResult?.error) {
  console.error("RESEND ERROR:", anyResult.error);
  return NextResponse.json(
    { error: anyResult.error.message || "Email rejected by Resend" },
    { status: 500 }
  );
}

return NextResponse.json({
  ok: true,
  id: anyResult?.data?.id ?? null,
});
```

} catch (err: any) {
console.error("EMAIL ROUTE ERROR:", err);
return NextResponse.json(
{ error: err?.message ?? "Email failed" },
{ status: 500 }
);
}
}