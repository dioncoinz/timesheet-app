import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type SubmissionRecord = {
  id: string;
  submittedAt: string;
  dateISO: string;
  company: string;
  lineCount: number;
  totalHours: number;
  emailTo: string;
};

type SubmissionRow = {
  id: string;
  submitted_at: string;
  date_iso: string;
  company: string;
  line_count: number;
  total_hours: number;
  email_to: string;
};

const LOCAL_SUBMISSIONS_FILE_PATH = path.join(
  process.cwd(),
  "data",
  "submissions.json"
);

const SUPABASE_TABLE = "submission_records";

function getSupabaseConfig() {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !serviceRoleKey) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    serviceRoleKey,
  };
}

function isSubmissionRecord(value: unknown): value is SubmissionRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as SubmissionRecord).id === "string" &&
      typeof (value as SubmissionRecord).submittedAt === "string" &&
      typeof (value as SubmissionRecord).dateISO === "string" &&
      typeof (value as SubmissionRecord).company === "string" &&
      typeof (value as SubmissionRecord).lineCount === "number" &&
      typeof (value as SubmissionRecord).totalHours === "number" &&
      typeof (value as SubmissionRecord).emailTo === "string"
  );
}

function mapRowToRecord(row: SubmissionRow): SubmissionRecord {
  return {
    id: row.id,
    submittedAt: row.submitted_at,
    dateISO: row.date_iso,
    company: row.company,
    lineCount: row.line_count,
    totalHours: row.total_hours,
    emailTo: row.email_to,
  };
}

function mapRecordToRow(
  record: Omit<SubmissionRecord, "id" | "submittedAt">
): Omit<SubmissionRow, "id" | "submitted_at"> {
  return {
    date_iso: record.dateISO,
    company: record.company,
    line_count: record.lineCount,
    total_hours: record.totalHours,
    email_to: record.emailTo,
  };
}

async function ensureDataDirectory() {
  await mkdir(path.dirname(LOCAL_SUBMISSIONS_FILE_PATH), { recursive: true });
}

async function readLocalSubmissionRecords(): Promise<SubmissionRecord[]> {
  try {
    const raw = await readFile(LOCAL_SUBMISSIONS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isSubmissionRecord);
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return [];
    throw error;
  }
}

async function appendLocalSubmissionRecord(
  record: Omit<SubmissionRecord, "id" | "submittedAt">
) {
  const records = await readLocalSubmissionRecords();
  const nextRecord: SubmissionRecord = {
    ...record,
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
  };

  records.unshift(nextRecord);
  await ensureDataDirectory();
  await writeFile(LOCAL_SUBMISSIONS_FILE_PATH, JSON.stringify(records, null, 2), "utf8");

  return nextRecord;
}

async function readSupabaseSubmissionRecords(config: {
  url: string;
  serviceRoleKey: string;
}): Promise<SubmissionRecord[]> {
  const response = await fetch(
    `${config.url}/rest/v1/${SUPABASE_TABLE}?select=id,submitted_at,date_iso,company,line_count,total_hours,email_to&order=submitted_at.desc`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Supabase read failed with status ${response.status}`);
  }

  const rows = (await response.json()) as SubmissionRow[];
  if (!Array.isArray(rows)) return [];

  return rows.map(mapRowToRecord).filter(isSubmissionRecord);
}

async function appendSupabaseSubmissionRecord(
  config: { url: string; serviceRoleKey: string },
  record: Omit<SubmissionRecord, "id" | "submittedAt">
) {
  const response = await fetch(`${config.url}/rest/v1/${SUPABASE_TABLE}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(mapRecordToRow(record)),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase write failed with status ${response.status}: ${detail}`);
  }

  const rows = (await response.json()) as SubmissionRow[];
  const created = Array.isArray(rows) ? rows[0] : null;

  if (!created) {
    throw new Error("Supabase write returned no created row");
  }

  return mapRowToRecord(created);
}

export async function readSubmissionRecords(): Promise<SubmissionRecord[]> {
  const supabase = getSupabaseConfig();
  if (!supabase) {
    return readLocalSubmissionRecords();
  }

  try {
    return await readSupabaseSubmissionRecords(supabase);
  } catch (error) {
    console.error("SUBMISSION READ ERROR: falling back to local storage", error);
    return readLocalSubmissionRecords();
  }
}

export async function appendSubmissionRecord(
  record: Omit<SubmissionRecord, "id" | "submittedAt">
) {
  const supabase = getSupabaseConfig();
  if (!supabase) {
    return appendLocalSubmissionRecord(record);
  }

  try {
    return await appendSupabaseSubmissionRecord(supabase, record);
  } catch (error) {
    console.error("SUBMISSION WRITE ERROR: falling back to local storage", error);
    return appendLocalSubmissionRecord(record);
  }
}
