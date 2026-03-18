import Link from "next/link";
import { redirect } from "next/navigation";

import { hasPinSession } from "@/lib/auth";
import { readCompaniesFromAllWorkbooks } from "@/lib/options";
import {
  readSubmissionRecords,
  type SubmissionRecord,
} from "@/lib/submissions";

type SubmissionGroup = {
  dateISO: string;
  submissions: SubmissionRecord[];
  totalHours: number;
  submittedCompanies: string[];
  outstandingCompanies: string[];
};

function formatDate(dateISO: string) {
  const parsed = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateISO;

  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function groupSubmissions(
  records: SubmissionRecord[],
  companies: string[]
): SubmissionGroup[] {
  const groups = new Map<string, SubmissionRecord[]>();

  for (const record of records) {
    const existing = groups.get(record.dateISO) ?? [];
    existing.push(record);
    groups.set(record.dateISO, existing);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([dateISO, submissions]) => {
      const submittedCompanies = Array.from(
        new Set(submissions.map((item) => item.company))
      ).sort((left, right) => left.localeCompare(right));
      const outstandingCompanies = companies.filter(
        (company) => !submittedCompanies.includes(company)
      );

      return {
        dateISO,
        submissions,
        totalHours: submissions.reduce((sum, item) => sum + item.totalHours, 0),
        submittedCompanies,
        outstandingCompanies,
      };
    });
}

export default async function AdminPage() {
  const authed = await hasPinSession();
  if (!authed) {
    redirect("/pin");
  }

  const [records, companies] = await Promise.all([
    readSubmissionRecords(),
    readCompaniesFromAllWorkbooks(),
  ]);
  const groups = groupSubmissions(records, companies);

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "24px auto",
        padding: 20,
        fontFamily: "sans-serif",
        color: "#fff",
        background:
          "radial-gradient(1200px 600px at 30% 0%, #222 0%, #0b0b0b 40%, #000 100%)",
        borderRadius: 14,
        border: "1px solid #222",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>Admin Dashboard</h1>
          <p style={{ margin: "8px 0 0", opacity: 0.8 }}>
            Submitted timesheets by company and day.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{
              padding: "12px 16px",
              fontSize: 16,
              background: "#333",
              color: "#fff",
              border: "1px solid #666",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Back to Timesheet
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <div
          style={{
            border: "1px solid #444",
            background: "linear-gradient(#111, #0a0a0a)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          No submitted timesheets have been recorded yet. A record is created
          after a successful email submission.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {groups.map((group) => (
            <section
              key={group.dateISO}
              style={{
                border: "1px solid #444",
                background: "linear-gradient(#111, #0a0a0a)",
                borderRadius: 12,
                padding: 18,
                boxShadow: "0 0 18px rgba(255,255,255,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 14,
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 24 }}>{formatDate(group.dateISO)}</h2>
                  <div style={{ marginTop: 6, opacity: 0.75 }}>{group.dateISO}</div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    fontSize: 14,
                  }}
                >
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: "1px solid #3b3b3b",
                      background: "#181818",
                    }}
                  >
                    Submitted: <strong>{group.submittedCompanies.length}</strong>
                  </div>
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: "1px solid #3b3b3b",
                      background: "#181818",
                    }}
                  >
                    Outstanding: <strong>{group.outstandingCompanies.length}</strong>
                  </div>
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: "1px solid #3b3b3b",
                      background: "#181818",
                    }}
                  >
                    Total hours: <strong>{group.totalHours.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 14,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    border: "1px solid #2c2c2c",
                    borderRadius: 10,
                    background: "#141414",
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>
                    Submitted
                  </div>
                  {group.submittedCompanies.length === 0 ? (
                    <div style={{ opacity: 0.72 }}>None recorded yet.</div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {group.submittedCompanies.map((company) => (
                        <span
                          key={company}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: "#1d3523",
                            border: "1px solid #2c8c4d",
                          }}
                        >
                          {company}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    border: "1px solid #2c2c2c",
                    borderRadius: 10,
                    background: "#141414",
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>
                    Outstanding
                  </div>
                  {group.outstandingCompanies.length === 0 ? (
                    <div style={{ opacity: 0.72 }}>All companies have submitted.</div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {group.outstandingCompanies.map((company) => (
                        <span
                          key={company}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: "#362114",
                            border: "1px solid #8a6d3b",
                          }}
                        >
                          {company}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {group.submissions.map((submission) => (
                  <div
                    key={submission.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: 12,
                      padding: "14px 16px",
                      border: "1px solid #2c2c2c",
                      borderRadius: 10,
                      background: "#141414",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{submission.company}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.72, fontSize: 13 }}>Submitted</div>
                      <div>{formatDateTime(submission.submittedAt)}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.72, fontSize: 13 }}>Rows</div>
                      <div>{submission.lineCount}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.72, fontSize: 13 }}>Hours</div>
                      <div>{submission.totalHours.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

