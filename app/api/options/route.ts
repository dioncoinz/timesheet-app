import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";

function toText(v: any): string {
  if (v == null) return "";
  if (typeof v === "object" && "text" in v) return String(v.text ?? "").trim();
  return String(v).trim();
}
function v(cell: any): string {
  const val = cell?.value;
  if (val == null) return "";
  if (typeof val === "object" && "text" in val) {
    return String(val.text ?? "").trim();
  }
  return String(val).trim();
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "Master App Timesheet.xlsx");

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);

    const wsNames = wb.getWorksheet("Names");
    const wsWO = wb.getWorksheet("Work Orders");

    if (!wsNames || !wsWO) {
      return NextResponse.json(
        { error: "Missing required sheets. Expected: Names and Work Orders." },
        { status: 400 }
      );
    }

    // Companies from Names!J
    const companiesSet = new Set<string>();
    wsNames.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const companyJ = toText(row.getCell(10).value); // J
      if (companyJ) companiesSet.add(companyJ);
    });
    const companies = Array.from(companiesSet).sort();

    // People by company (Names A-D)
    const peopleByCompany: Record<string, { name: string; sapId: string; role: string }[]> = {};
    wsNames.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const companyA = toText(row.getCell(1).value); // A
      const nameB = toText(row.getCell(2).value);    // B
      const sapIdC = toText(row.getCell(3).value);   // C
      const roleD = toText(row.getCell(4).value);    // D

      if (!companyA || !nameB) return;

      if (!peopleByCompany[companyA]) peopleByCompany[companyA] = [];
      peopleByCompany[companyA].push({ name: nameB, sapId: sapIdC, role: roleD });
    });

    // Role -> Service Master (Names G/H)
    const serviceMasterByRole: Record<string, string> = {};
    wsNames.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const roleG = toText(row.getCell(7).value); // G
      const smH = toText(row.getCell(8).value);   // H
      if (roleG && smH) serviceMasterByRole[roleG.toLowerCase()] = smH;
    });

    // PO by company (Names col J/K/L = Company / Purchase order / Item number)
const poByCompany: Record<string, { poNumber: string; poItem: string }> = {};

wsNames.eachRow((row, rowNumber) => {
  if (rowNumber === 1) return;

  const company = v(row.getCell(10));  // J
  const poNumber = v(row.getCell(11)); // K
  const poItem = v(row.getCell(12));   // L

  if (!company) return;

  // Only set if we have at least one of the values.
  // (If the PO table is only filled on a couple rows, this will still work.)
  if (poNumber || poItem) {
    poByCompany[company] = { poNumber, poItem };
  }
});


    // Work orders by company (Work Orders A, B, C, E, F)
    const workOrdersByCompany: Record<
      string,
        { woNumber: string; opNumber: string; opShortText: string; woHeader: string; workCenter: string }[]
> = {};

    wsWO.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const woA = toText(row.getCell(1).value);       // A
      const opB = toText(row.getCell(2).value);       // B
      const headerC = toText(row.getCell(3).value);   // C
      const opShortD = toText(row.getCell(4).value); // D = Op Short Text
      const wcE = toText(row.getCell(5).value);       // E
      const companyF = toText(row.getCell(6).value);  // F
      

      if (!companyF || !woA) return;

      if (!workOrdersByCompany[companyF]) workOrdersByCompany[companyF] = [];
      workOrdersByCompany[companyF].push({
        woNumber: woA,
        opNumber: opB,
        opShortText: opShortD,
        woHeader: headerC,
        workCenter: wcE,
      });
    });

    return NextResponse.json({
      ok: true,
      source: "excel",
      companies,
      peopleByCompany,
      serviceMasterByRole,
      poByCompany,
      workOrdersByCompany,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to load options from Excel" },
      { status: 500 }
    );
  }
}
