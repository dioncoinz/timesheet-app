"use client";

import { useEffect, useMemo, useState } from "react";

type Person = { name: string; sapId: string; role: string };
type WorkOrder = { woNumber: string; opNumber: string; woHeader: string; workCenter: string };

type Options = {
  ok: boolean;
  source: string;
  companies: string[];
  peopleByCompany: Record<string, Person[]>;
  serviceMasterByRole: Record<string, string>;
  poByCompany: Record<string, { poNumber: string; poItem: string }>;
  workOrdersByCompany: Record<string, WorkOrder[]>;
};

type Row = {
  employeeName: string;
  hours: string; // keep as string for input
};

type WOBlock = {
  woNumber: string;
  opNumber: string;
  woHeader: string;
  workCenter: string;
  rows: Row[];
};

type ExportLine = {
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

export default function HomePage() {
  const [opts, setOpts] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [dateISO, setDateISO] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [company, setCompany] = useState("");

  const [blocks, setBlocks] = useState<WOBlock[]>([]);

  const [exporting, setExporting] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  // Load options from Excel (server)
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch("/api/options");
        const data = await res.json();
        if (!res.ok || data?.ok === false) throw new Error(data?.error ?? "Failed to load options");
        setOpts(data);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load options");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const companies = useMemo(() => opts?.companies ?? [], [opts]);

  const workOrdersForCompany = useMemo(() => {
    if (!opts || !company) return [];
    return opts.workOrdersByCompany?.[company] ?? [];
  }, [opts, company]);

  const peopleForCompany = useMemo(() => {
    if (!opts || !company) return [];
    return opts.peopleByCompany?.[company] ?? [];
  }, [opts, company]);

  const personByName = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of peopleForCompany) map.set(p.name, p);
    return map;
  }, [peopleForCompany]);

  // Reset blocks when company changes (keeps it clean)
  useEffect(() => {
    setBlocks([]);
    setUiError(null);
  }, [company]);

  // --- Helpers ---
  function safeHours(s: string): number {
    const n = Number(String(s ?? "").trim());
    return Number.isFinite(n) ? n : 0;
  }

  function parseHoursStrict(s: string): number {
    const n = Number(String(s ?? "").trim());
    return Number.isFinite(n) ? n : NaN;
  }

  function blockTotal(b: WOBlock): number {
    return b.rows.reduce((sum, r) => sum + (r.employeeName ? safeHours(r.hours) : 0), 0);
  }

  const grandTotal = useMemo(() => {
    return blocks.reduce((sum, b) => sum + blockTotal(b), 0);
  }, [blocks]);

  function filenameFromContentDisposition(headerVal: string | null): string | null {
    if (!headerVal) return null;
    const m = headerVal.match(/filename\*?=(?:UTF-8''|")?([^";]+)"?/i);
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }

  // --- UI actions ---
  function addWorkOrderBlock() {
    if (!company) return;
    setUiError(null);
    setBlocks((prev) => [
      ...prev,
      {
        woNumber: "",
        opNumber: "",
        woHeader: "",
        workCenter: "",
        rows: [{ employeeName: "", hours: "" }],
      },
    ]);
  }

  function removeBlock(blockIndex: number) {
    setUiError(null);
    setBlocks((prev) => prev.filter((_, i) => i !== blockIndex));
  }

  function addPersonRow(blockIndex: number) {
    setUiError(null);
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIndex ? { ...b, rows: [...b.rows, { employeeName: "", hours: "" }] } : b
      )
    );
  }

  // Auto-add row if last row becomes complete
  function updateRow(blockIndex: number, rowIndex: number, patch: Partial<Row>) {
    setUiError(null);
    setBlocks((prev) =>
      prev.map((b, i) => {
        if (i !== blockIndex) return b;

        const rows = b.rows.map((r, ri) => (ri === rowIndex ? { ...r, ...patch } : r));

        const last = rows[rows.length - 1];
        const lastComplete = Boolean(last.employeeName) && safeHours(last.hours) > 0;
        if (lastComplete) rows.push({ employeeName: "", hours: "" });

        return { ...b, rows };
      })
    );
  }

  function removeRow(blockIndex: number, rowIndex: number) {
    setUiError(null);
    setBlocks((prev) =>
      prev.map((b, i) => {
        if (i !== blockIndex) return b;
        const rows = b.rows.filter((_, ri) => ri !== rowIndex);
        return { ...b, rows: rows.length ? rows : [{ employeeName: "", hours: "" }] };
      })
    );
  }

  function onSelectWO(blockIndex: number, woKey: string) {
    setUiError(null);

    if (!woKey) {
      setBlocks((prev) =>
        prev.map((b, i) =>
          i === blockIndex ? { ...b, woNumber: "", opNumber: "", woHeader: "", workCenter: "" } : b
        )
      );
      return;
    }

    const [woNumber, opNumber, workCenter] = woKey.split("|");
    const found = workOrdersForCompany.find(
      (w) => w.woNumber === woNumber && w.opNumber === opNumber && w.workCenter === workCenter
    );

    if (!found) return;

    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIndex
          ? { ...b, woNumber: found.woNumber, opNumber: found.opNumber, woHeader: found.woHeader, workCenter: found.workCenter }
          : b
      )
    );
  }

  // --- Export (Pass 3) ---
  async function sendForUpload() {
    setUiError(null);

    if (!opts) return;
    if (!dateISO) return setUiError("Please select a date.");
    if (!company) return setUiError("Please select a company.");
    if (blocks.length === 0) return setUiError("Add at least one work order.");

    const poInfo = opts.poByCompany?.[company] ?? { poNumber: "", poItem: "" };

    const lines: ExportLine[] = [];

    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi];

      if (!b.woNumber || !b.opNumber || !b.workCenter) {
        return setUiError(`Work order block #${bi + 1}: Please select a work order.`);
      }

      for (let ri = 0; ri < b.rows.length; ri++) {
        const r = b.rows[ri];

        // allow trailing blank row
        if (!r.employeeName && !r.hours) continue;

        if (!r.employeeName) return setUiError(`Block #${bi + 1}, row #${ri + 1}: Select a person.`);
        const p = personByName.get(r.employeeName);
        if (!p) return setUiError(`Block #${bi + 1}, row #${ri + 1}: Person not found.`);

        const h = parseHoursStrict(r.hours);
        if (!Number.isFinite(h) || h <= 0) {
          return setUiError(`Block #${bi + 1}, row #${ri + 1}: Enter valid hours (> 0).`);
        }

        lines.push({
          dateISO,
          company,
          employeeName: p.name,
          sapId: p.sapId ?? "",
          role: p.role ?? "",
          hours: h,
          woNumber: b.woNumber,
          opNumber: b.opNumber,
          workCenter: b.workCenter,
          poNumber: poInfo.poNumber ?? "",
          poItem: poInfo.poItem ?? "",
        });
      }
    }

    if (lines.length === 0) return setUiError("No valid people/hours entered yet.");

    setExporting(true);
    try {
      const res = await fetch("/api/export/vendor-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });

      if (!res.ok) {
        let msg = `Export failed (${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();
      const cd = res.headers.get("content-disposition");
      const filename =
        filenameFromContentDisposition(cd) ??
        `VendorEntry_${company}_${dateISO}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setUiError(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  }

  // --- Render ---
  return (
    <main style={{ maxWidth: 1000, margin: "24px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: 6 }}>Greatland WO Confirmation Sheet</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Date → Company → Work Orders → People & hours → Export Vendor Entry
      </p>
<button
  onClick={async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/pin";
  }}
  style={{ padding: "8px 12px", marginTop: 8 }}
>
  Log out
</button>

      {loading && <p>Loading options…</p>}

      {err && (
        <div style={{ background: "#fee", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <strong>Error:</strong> {err}
        </div>
      )}

      {uiError && (
        <div style={{ background: "#fff3cd", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <strong>Fix needed:</strong> {uiError}
        </div>
      )}

      {!loading && opts && (
        <>
          {/* Header controls */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6 }}>Date</label>
              <input
                type="date"
                value={dateISO}
                onChange={(e) => setDateISO(e.target.value)}
                style={{ width: "100%", padding: 10, fontSize: 16 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6 }}>Company</label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                style={{ width: "100%", padding: 10, fontSize: 16 }}
              >
                <option value="">Select…</option>
                {companies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {company && (
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
                  PO: {opts.poByCompany?.[company]?.poNumber ?? "—"} / Item:{" "}
                  {opts.poByCompany?.[company]?.poItem ?? "—"}
                </div>
              )}
            </div>
          </div>

          {/* Add work order */}
          <div style={{ marginTop: 18, display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={addWorkOrderBlock}
              disabled={!company}
              style={{ padding: "10px 14px", cursor: company ? "pointer" : "not-allowed" }}
            >
              + Add Work Order
            </button>
            {!company && <span style={{ opacity: 0.7 }}>Select a company first</span>}
          </div>

          {blocks.length === 0 && (
            <div style={{ marginTop: 14, padding: 12, border: "1px dashed #bbb", borderRadius: 8 }}>
              No work orders yet. Click <strong>+ Add Work Order</strong>.
            </div>
          )}

          {/* Work order blocks */}
          {blocks.map((b, bi) => {
            const selectedKey =
              b.woNumber && b.opNumber && b.workCenter ? `${b.woNumber}|${b.opNumber}|${b.workCenter}` : "";

            return (
              <div
                key={bi}
                style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 10, padding: 12 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: 6 }}>
                      Work Order (filtered by company)
                    </label>

                    <select
                      value={selectedKey}
                      onChange={(e) => onSelectWO(bi, e.target.value)}
                      style={{ width: "100%", padding: 10, fontSize: 16 }}
                    >
                      <option value="">Select work order…</option>
                      {workOrdersForCompany.map((w) => {
                        const key = `${w.woNumber}|${w.opNumber}|${w.workCenter}`;
                        const label = `${w.woHeader} — WO ${w.woNumber} / OP ${w.opNumber} (${w.workCenter})`;
                        return (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        );
                      })}
                    </select>

                    {b.woNumber ? (
                      <div style={{ marginTop: 8, fontSize: 14, opacity: 0.85 }}>
                        <div>
                          <strong>WO:</strong> {b.woNumber} &nbsp; <strong>OP:</strong> {b.opNumber} &nbsp;
                          <strong>WC:</strong> {b.workCenter}
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 8, fontSize: 14, opacity: 0.65 }}>
                        Select a work order to enable people rows.
                      </div>
                    )}
                  </div>

                  <button onClick={() => removeBlock(bi)} style={{ height: 42 }}>
                    Remove
                  </button>
                </div>

                {/* People header + WO total */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                  <div style={{ fontWeight: 700 }}>People</div>
                  <div style={{ fontSize: 14, opacity: 0.8 }}>
                    WO total: <strong>{blockTotal(b).toFixed(2)}</strong> hrs
                  </div>
                </div>

                {/* People rows */}
                {b.rows.map((r, ri) => {
                  // prevent duplicates in this WO block (exclude current row)
                  const used = new Set(
                    b.rows.map((x, idx) => (idx === ri ? "" : x.employeeName)).filter(Boolean)
                  );

                  return (
                    <div
                      key={ri}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 140px 90px",
                        gap: 10,
                        marginTop: 10,
                        alignItems: "center",
                      }}
                    >
                      <select
                        value={r.employeeName}
                        onChange={(e) => updateRow(bi, ri, { employeeName: e.target.value })}
                        style={{ width: "100%", padding: 10, fontSize: 16 }}
                        disabled={!b.woNumber}
                      >
                        <option value="">Select person…</option>
                        {peopleForCompany.map((p) => {
                          const isUsed = used.has(p.name);
                          return (
                            <option key={p.name} value={p.name} disabled={isUsed}>
                              {p.name} ({p.role}){isUsed ? " — already added" : ""}
                            </option>
                          );
                        })}
                      </select>

                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="Hours"
                        value={r.hours}
                        onChange={(e) => updateRow(bi, ri, { hours: e.target.value })}
                        style={{ width: "100%", padding: 10, fontSize: 16 }}
                        disabled={!b.woNumber}
                      />

                      <button onClick={() => removeRow(bi, ri)} disabled={!b.woNumber}>
                        X
                      </button>
                    </div>
                  );
                })}

                <button onClick={() => addPersonRow(bi)} disabled={!b.woNumber} style={{ marginTop: 10 }}>
                  + Add Another Person
                </button>
              </div>
            );
          })}

          {/* Grand total + Export */}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", fontSize: 16 }}>
            Total hours: <strong style={{ marginLeft: 8 }}>{grandTotal.toFixed(2)}</strong>
          </div>

          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={sendForUpload}
              disabled={exporting || !company || blocks.length === 0}
              style={{ padding: "14px 18px", fontSize: 16, cursor: exporting ? "not-allowed" : "pointer" }}
            >
              {exporting ? "Generating…" : "Send for upload (email)"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
