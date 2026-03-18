import { readdir } from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";

export type Person = { name: string; sapId: string; role: string };

export type WorkOrder = {
  woNumber: string;
  opNumber: string;
  opShortText: string;
  woHeader: string;
  workCenter: string;
};

export type ShutdownOption = {
  id: string;
  label: string;
};

export type WorkbookOptionsData = {
  companies: string[];
  peopleByCompany: Record<string, Person[]>;
  serviceMasterByRole: Record<string, string>;
  poByCompany: Record<string, { poNumber: string; poItem: string }>;
  workOrdersByCompany: Record<string, WorkOrder[]>;
};

const PUBLIC_DIR = path.join(process.cwd(), "public");
const PUBLIC_DATA_DIR = path.join(PUBLIC_DIR, "data");
const DEFAULT_WORKBOOK_ID = "data/Master App Timesheet.xlsx";

function toText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text?: unknown }).text ?? "").trim();
  }
  return String(value).trim();
}

function formatWorkbookLabel(workbookId: string): string {
  const parsed = path.parse(workbookId);
  return parsed.name.replace(/[_-]+/g, " ").trim();
}

async function collectWorkbookIds(dirPath: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const workbookIds: string[] = [];

  for (const entry of entries) {
    const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      workbookIds.push(...(await collectWorkbookIds(fullPath, nextPrefix)));
      continue;
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".xlsx") {
      workbookIds.push(nextPrefix);
    }
  }

  return workbookIds;
}

export async function listShutdownWorkbooks(): Promise<ShutdownOption[]> {
  const workbookIds = await collectWorkbookIds(PUBLIC_DATA_DIR, "data");

  return workbookIds
    .sort((left, right) => left.localeCompare(right))
    .map((id) => ({
      id,
      label: formatWorkbookLabel(id),
    }));
}

export async function resolveShutdownWorkbook(shutdownId?: string) {
  const shutdowns = await listShutdownWorkbooks();

  if (shutdowns.length === 0) {
    throw new Error("No Excel workbooks were found in the public folder.");
  }

  const selected =
    (shutdownId
      ? shutdowns.find((shutdown) => shutdown.id === shutdownId)
      : undefined) ??
    shutdowns.find((shutdown) => shutdown.id === DEFAULT_WORKBOOK_ID) ??
    shutdowns[0];

  if (!selected) {
    throw new Error(`Shutdown workbook "${shutdownId}" was not found.`);
  }

  return {
    shutdowns,
    selectedShutdown: selected,
    filePath: path.join(PUBLIC_DIR, ...selected.id.split("/")),
  };
}

export async function readWorkbookOptions(
  shutdownId?: string
): Promise<WorkbookOptionsData> {
  const { filePath } = await resolveShutdownWorkbook(shutdownId);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const wsNames = workbook.getWorksheet("Names");
  const wsWO = workbook.getWorksheet("Work Orders");

  if (!wsNames || !wsWO) {
    throw new Error("Missing required sheets. Expected: Names and Work Orders.");
  }

  const companiesSet = new Set<string>();
  wsNames.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const companyJ = toText(row.getCell(10).value);
    if (companyJ) companiesSet.add(companyJ);
  });
  const companies = Array.from(companiesSet).sort((left, right) =>
    left.localeCompare(right)
  );

  const peopleByCompany: Record<string, Person[]> = {};
  wsNames.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const companyA = toText(row.getCell(1).value);
    const nameB = toText(row.getCell(2).value);
    const sapIdC = toText(row.getCell(3).value);
    const roleD = toText(row.getCell(4).value);

    if (!companyA || !nameB) return;

    if (!peopleByCompany[companyA]) peopleByCompany[companyA] = [];
    peopleByCompany[companyA].push({ name: nameB, sapId: sapIdC, role: roleD });
  });

  const serviceMasterByRole: Record<string, string> = {};
  wsNames.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const roleG = toText(row.getCell(7).value);
    const smH = toText(row.getCell(8).value);
    if (roleG && smH) serviceMasterByRole[roleG.toLowerCase()] = smH;
  });

  const poByCompany: Record<string, { poNumber: string; poItem: string }> = {};
  wsNames.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const company = toText(row.getCell(10).value);
    const poNumber = toText(row.getCell(11).value);
    const poItem = toText(row.getCell(12).value);

    if (!company) return;

    if (poNumber || poItem) {
      poByCompany[company] = { poNumber, poItem };
    }
  });

  const workOrdersByCompany: Record<string, WorkOrder[]> = {};
  wsWO.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const woA = toText(row.getCell(1).value);
    const opB = toText(row.getCell(2).value);
    const headerC = toText(row.getCell(3).value);
    const opShortD = toText(row.getCell(4).value);
    const wcE = toText(row.getCell(5).value);
    const companyF = toText(row.getCell(6).value);

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

  return {
    companies,
    peopleByCompany,
    serviceMasterByRole,
    poByCompany,
    workOrdersByCompany,
  };
}

export async function readCompaniesFromWorkbook(shutdownId?: string): Promise<string[]> {
  const { companies } = await readWorkbookOptions(shutdownId);
  return companies;
}

export async function readCompaniesFromAllWorkbooks(): Promise<string[]> {
  const shutdowns = await listShutdownWorkbooks();
  const companies = new Set<string>();

  for (const shutdown of shutdowns) {
    const nextCompanies = await readCompaniesFromWorkbook(shutdown.id);
    for (const company of nextCompanies) {
      companies.add(company);
    }
  }

  return Array.from(companies).sort((left, right) => left.localeCompare(right));
}



