import path from "path";
import ExcelJS from "exceljs";

export type Person = {
  name: string;
  sapId: string;
  role: string;
  serviceMasterNumber: string;
};

export type WorkOrder = {
  woNumber: string;
  opNumber: string;
  opShortText: string;
  workCenter: string;
};

export type ShutdownOption = {
  id: string;
  label: string;
};

export type WorkbookOptionsData = {
  companies: string[];
  peopleByCompany: Record<string, Person[]>;
  poByCompany: Record<string, { poNumber: string; poItem: string }>;
  workOrdersByCompany: Record<string, WorkOrder[]>;
};

const DEFAULT_WORKBOOK_ID = "November 2026 Shutdown.xlsx";
const DEFAULT_WORKBOOK_PATH = path.join(
  process.cwd(),
  "public",
  "data",
  DEFAULT_WORKBOOK_ID
);

function toText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text?: unknown }).text ?? "").trim();
  }
  return String(value).trim();
}

function companyKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function formatWorkbookLabel(workbookId: string): string {
  const parsed = path.parse(workbookId);
  return parsed.name.replace(/[_-]+/g, " ").trim();
}

export async function listShutdownWorkbooks(): Promise<ShutdownOption[]> {
  return [{
    id: DEFAULT_WORKBOOK_ID,
    label: formatWorkbookLabel(DEFAULT_WORKBOOK_ID),
  }];
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
    filePath: DEFAULT_WORKBOOK_PATH,
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
  const companyNames = new Map(companies.map((name) => [companyKey(name), name]));

  function resolveCompanyLabel(label: string): string {
    const key = companyKey(label);
    const exactMatch = companyNames.get(key);
    if (exactMatch) return exactMatch;

    // The employee roster uses "Boltprep"; the company/PO list uses "Bolt prep".
    if (key === "boltprep") {
      return companyNames.get("bolt prep") ?? label;
    }

    // SMS crew disciplines share the SMS Group people and purchase order.
    if (/^sms(?:$|[\s/-])/.test(key)) {
      return companyNames.get("sms group") ?? label;
    }

    return label;
  }

  const peopleByCompany: Record<string, Person[]> = {};
  wsNames.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const companyLabel = toText(row.getCell(1).value);
    const companyA = resolveCompanyLabel(companyLabel);
    const nameB = toText(row.getCell(2).value);
    const sapIdC = toText(row.getCell(3).value);
    const roleD = toText(row.getCell(4).value);
    const serviceMasterE = toText(row.getCell(5).value);

    if (!companyA || !nameB) return;

    if (!peopleByCompany[companyA]) peopleByCompany[companyA] = [];
    peopleByCompany[companyA].push({
      name: nameB,
      sapId: sapIdC,
      role: roleD,
      serviceMasterNumber: serviceMasterE,
    });
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
  const seenWorkOrders = new Map<string, Set<string>>();
  wsWO.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const woA = toText(row.getCell(1).value);
    const opB = toText(row.getCell(2).value);
    const opShortC = toText(row.getCell(3).value);
    const wcD = toText(row.getCell(4).value);
    const companyE = toText(row.getCell(5).value);

    if (!companyE || !woA) return;

    for (const label of companyE.split(",").map((value) => value.trim()).filter(Boolean)) {
      const company = resolveCompanyLabel(label);
      const workOrderKey = JSON.stringify([woA, opB, opShortC, wcD]);
      const seen = seenWorkOrders.get(company) ?? new Set<string>();
      if (seen.has(workOrderKey)) continue;
      seen.add(workOrderKey);
      seenWorkOrders.set(company, seen);

      if (!workOrdersByCompany[company]) workOrdersByCompany[company] = [];
      workOrdersByCompany[company].push({
        woNumber: woA,
        opNumber: opB,
        opShortText: opShortC,
        workCenter: wcD,
      });
    }
  });

  return {
    companies,
    peopleByCompany,
    poByCompany,
    workOrdersByCompany,
  };
}

export async function readCompaniesFromWorkbook(shutdownId?: string): Promise<string[]> {
  const { companies } = await readWorkbookOptions(shutdownId);
  return companies;
}

export async function readCompaniesFromAllWorkbooks(): Promise<string[]> {
  return readCompaniesFromWorkbook();
}





