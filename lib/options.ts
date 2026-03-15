import ExcelJS from "exceljs";
import path from "path";

function toText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && v !== null && "text" in v) {
    return String((v as { text?: unknown }).text ?? "").trim();
  }
  return String(v).trim();
}

export async function readCompaniesFromWorkbook(): Promise<string[]> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "Master App Timesheet.xlsx"
  );

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet("Names");
  if (!worksheet) {
    throw new Error('Missing required sheet "Names".');
  }

  const companies = new Set<string>();

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const companyFromNames = toText(row.getCell(1).value);
    const companyFromPoTable = toText(row.getCell(10).value);

    if (companyFromNames) companies.add(companyFromNames);
    if (companyFromPoTable) companies.add(companyFromPoTable);
  });

  return Array.from(companies).sort((left, right) => left.localeCompare(right));
}
