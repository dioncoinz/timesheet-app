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

const submissionsFilePath = path.join(
  process.cwd(),
  "data",
  "submissions.json"
);

async function ensureDataDirectory() {
  await mkdir(path.dirname(submissionsFilePath), { recursive: true });
}

export async function readSubmissionRecords(): Promise<SubmissionRecord[]> {
  try {
    const raw = await readFile(submissionsFilePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is SubmissionRecord =>
        item &&
        typeof item.id === "string" &&
        typeof item.submittedAt === "string" &&
        typeof item.dateISO === "string" &&
        typeof item.company === "string" &&
        typeof item.lineCount === "number" &&
        typeof item.totalHours === "number" &&
        typeof item.emailTo === "string"
    );
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return [];
    throw error;
  }
}

export async function appendSubmissionRecord(
  record: Omit<SubmissionRecord, "id" | "submittedAt">
) {
  const records = await readSubmissionRecords();
  const nextRecord: SubmissionRecord = {
    ...record,
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
  };

  records.unshift(nextRecord);
  await ensureDataDirectory();
  await writeFile(submissionsFilePath, JSON.stringify(records, null, 2), "utf8");

  return nextRecord;
}
