"use client";

import { useEffect, useMemo, useState } from "react";

type Person = { name: string; sapId: string; role: string };

type WorkOrder = {
  woNumber: string;
  opNumber: string;
  opShortText: string;
  woHeader: string;
  workCenter: string;
};

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
  opShortText: string;
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
  serviceMasterNumber: string;

  hours: number;

  woNumber: string;
  opNumber: string;
  workCenter: string;

  poNumber: string;
  poItem: string;
};

const styles = {
  page: {
    maxWidth: 1200,
    margin: "24px auto",
    padding: 20,
    fontFamily: "sans-serif",
    color: "#fff",
    background:
      "radial-gradient(1200px 600px at 30% 0%, #222 0%, #0b0b0b 40%, #000 100%)",
    borderRadius: 14,
    border: "1px solid #222",
  } as React.CSSProperties,

  subtitle: { margin: "8px 0 16px 0", opacity: 0.85 } as React.CSSProperties,

  input: {
    width: "100%",
    padding: "14px 16px",
    fontSize: 18,
    background: "#2e2e2e",
    color: "#fff",
    border: "1px solid #555",
    borderRadius: 6,
    outline: "none",
  } as React.CSSProperties,

  button: {
    padding: "14px 20px",
    fontSize: 18,
    background: "#666",
    color: "#fff",
    border: "1px solid #777",
    borderRadius: 6,
    cursor: "pointer",
  } as React.CSSProperties,

  buttonGhost: {
    padding: "12px 16px",
    fontSize: 16,
    background: "#333",
    color: "#fff",
    border: "1px solid #666",
    borderRadius: 6,
    cursor: "pointer",
  } as React.CSSProperties,

  buttonDanger: {
    padding: "12px 16px",
    fontSize: 16,
    background: "#444",
    color: "#fff",
    border: "1px solid #777",
    borderRadius: 6,
    cursor: "pointer",
  } as React.CSSProperties,

  disabled: { opacity: 0.6, cursor: "not-allowed" } as React.CSSProperties,

  card: {
    border: "1px solid #444",
    background: "linear-gradient(#111, #0a0a0a)",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    boxShadow: "0 0 18px rgba(255,255,255,0.04)",
  } as React.CSSProperties,

  warn: {
    background: "#2b2412",
    border: "1px solid #8a6d3b",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  } as React.CSSProperties,

  err: {
    background: "#2a0f0f",
    border: "1px solid #7a2a2a",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  } as React.CSSProperties,
};
type SearchOption = { value: string; label: string; disabled?: boolean };

function SearchSelect(props: {
  value: string;
  options: SearchOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { value, options, placeholder, disabled, onChange } = props;

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = (globalThis as any).React?.useRef?.(null) ?? null; // fallback-safe

  // Keep input text in sync with selected label
  useEffect(() => {
    const found = options.find((o) => o.value === value);
    setQ(found ? found.label : "");
  }, [value, options]);

  // Close on outside click
  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const el = (wrapRef as any)?.current as HTMLElement | null;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [wrapRef]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [q, options]);

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <input
        value={q}
        disabled={disabled}
        placeholder={placeholder ?? "Search…"}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        style={{
          width: "100%",
          padding: "14px 16px",
          fontSize: 18,
          background: "#2e2e2e",
          color: "#fff",
          border: "1px solid #555",
          borderRadius: 6,
          outline: "none",
        }}
      />

      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#141414",
            border: "1px solid #444",
            borderRadius: 10,
            maxHeight: 320,
            overflowY: "auto",
            boxShadow: "0 10px 30px rgba(0,0,0,0.55)",
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: 12, opacity: 0.8 }}>No results</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={!!opt.disabled}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 14px",
                  background: "transparent",
                  color: opt.disabled ? "#777" : "#fff",
                  border: "none",
                  cursor: opt.disabled ? "not-allowed" : "pointer",
                  fontSize: 16,
                }}
                onMouseDown={(e) => e.preventDefault()} // prevent input blur flicker
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [opts, setOpts] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [dateISO, setDateISO] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [company, setCompany] = useState("");

  const [blocks, setBlocks] = useState<WOBlock[]>([]);
  const [exporting, setExporting] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  // Responsive flag
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 760);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Load options
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch("/api/options");
        const data = await res.json();
        if (!res.ok || data?.ok === false)
          throw new Error(data?.error ?? "Failed to load options");
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

  // Reset when company changes
  useEffect(() => {
    setBlocks([]);
    setUiError(null);
  }, [company]);

  // Helpers
  function safeHours(s: string): number {
    const n = Number(String(s ?? "").trim());
    return Number.isFinite(n) ? n : 0;
  }

  function parseHoursStrict(s: string): number {
    const n = Number(String(s ?? "").trim());
    return Number.isFinite(n) ? n : NaN;
  }

  function blockTotal(b: WOBlock): number {
    return b.rows.reduce(
      (sum, r) => sum + (r.employeeName ? safeHours(r.hours) : 0),
      0
    );
  }

  const grandTotal = useMemo(
    () => blocks.reduce((sum, b) => sum + blockTotal(b), 0),
    [blocks]
  );

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

  // UI actions
  function addWorkOrderBlock() {
    if (!company) return;
    setUiError(null);
    setBlocks((prev) => [
      ...prev,
      {
        woNumber: "",
        opNumber: "",
        opShortText: "",
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
        i === blockIndex
          ? { ...b, rows: [...b.rows, { employeeName: "", hours: "" }] }
          : b
      )
    );
  }

  function removeRow(blockIndex: number, rowIndex: number) {
    setUiError(null);
    setBlocks((prev) =>
      prev.map((b, i) => {
        if (i !== blockIndex) return b;
        const rows = b.rows.filter((_, ri) => ri !== rowIndex);
        return {
          ...b,
          rows: rows.length ? rows : [{ employeeName: "", hours: "" }],
        };
      })
    );
  }

  // Auto-add row if last row becomes complete
  function updateRow(blockIndex: number, rowIndex: number, patch: Partial<Row>) {
    setUiError(null);
    setBlocks((prev) =>
      prev.map((b, i) => {
        if (i !== blockIndex) return b;

        const rows = b.rows.map((r, ri) =>
          ri === rowIndex ? { ...r, ...patch } : r
        );

        const last = rows[rows.length - 1];
        const lastComplete =
          Boolean(last.employeeName) && safeHours(last.hours) > 0;
        if (lastComplete) rows.push({ employeeName: "", hours: "" });

        return { ...b, rows };
      })
    );
  }

  function onSelectWO(blockIndex: number, woKey: string) {
    setUiError(null);

    if (!woKey) {
      setBlocks((prev) =>
        prev.map((b, i) =>
          i === blockIndex
            ? {
                ...b,
                woNumber: "",
                opNumber: "",
                opShortText: "",
                woHeader: "",
                workCenter: "",
              }
            : b
        )
      );
      return;
    }

    const [woNumber, opNumber, workCenter] = woKey.split("|");

    const found = workOrdersForCompany.find(
      (w) =>
        w.woNumber === woNumber &&
        w.opNumber === opNumber &&
        w.workCenter === workCenter
    );
    if (!found) return;

    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIndex
          ? {
              ...b,
              woNumber: found.woNumber,
              opNumber: found.opNumber,
              opShortText: found.opShortText ?? "",
              woHeader: found.woHeader,
              workCenter: found.workCenter,
            }
          : b
      )
    );
  }

  // Build lines once for email + download
  function buildExportLines(): ExportLine[] | null {
    if (!opts) return null;

    if (!dateISO) return (setUiError("Please select a date."), null);
    if (!company) return (setUiError("Please select a company."), null);
    if (blocks.length === 0) return (setUiError("Add at least one work order."), null);

    const poInfo = opts.poByCompany?.[company] ?? { poNumber: "", poItem: "" };
    const lines: ExportLine[] = [];

    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi];

      if (!b.woNumber || !b.opNumber || !b.workCenter) {
        setUiError(`Work order block #${bi + 1}: Please select a work order.`);
        return null;
      }

      for (let ri = 0; ri < b.rows.length; ri++) {
        const r = b.rows[ri];

        // allow trailing blank row
        if (!r.employeeName && !r.hours) continue;

        if (!r.employeeName) {
          setUiError(`Block #${bi + 1}, row #${ri + 1}: Select a person.`);
          return null;
        }

        const p = personByName.get(r.employeeName);
        if (!p) {
          setUiError(`Block #${bi + 1}, row #${ri + 1}: Person not found.`);
          return null;
        }

        const h = parseHoursStrict(r.hours);
        if (!Number.isFinite(h) || h <= 0) {
          setUiError(`Block #${bi + 1}, row #${ri + 1}: Enter valid hours (> 0).`);
          return null;
        }

        const roleLower = (p.role ?? "").toLowerCase();
        const serviceMasterNumber = opts.serviceMasterByRole?.[roleLower] ?? "";

        lines.push({
          dateISO,
          company,
          employeeName: p.name,
          sapId: p.sapId ?? "",
          role: p.role ?? "",
          serviceMasterNumber,
          hours: h,
          woNumber: b.woNumber,
          opNumber: b.opNumber,
          workCenter: b.workCenter,
          poNumber: poInfo.poNumber ?? "",
          poItem: poInfo.poItem ?? "",
        });
      }
    }

    if (lines.length === 0) return (setUiError("No valid people/hours entered yet."), null);
    return lines;
  }

  async function sendEmail() {
    setUiError(null);
    const lines = buildExportLines();
    if (!lines) return;

    setExporting(true);
    try {
      const res = await fetch("/api/export/vendor-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });

      if (!res.ok) {
        let msg = `Email failed (${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }

      const j = await res.json();
      alert(`Email sent to ${j.emailedTo} ✅`);
    } catch (e: any) {
      setUiError(e?.message ?? "Email failed");
    } finally {
      setExporting(false);
    }
  }

  async function downloadToDevice() {
    setUiError(null);
    const lines = buildExportLines();
    if (!lines) return;

    setExporting(true);
    try {
      const res = await fetch("/api/export/vendor-entry/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });

      if (!res.ok) {
        let msg = `Download failed (${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();
      const cd = res.headers.get("content-disposition");
      const filename =
        filenameFromContentDisposition(cd) ?? `VendorEntry_${company}_${dateISO}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setUiError(e?.message ?? "Download failed");
    } finally {
      setExporting(false);
    }
  }

  // Render
  return (
    <main
      style={{
        ...styles.page,
        padding: isMobile ? 14 : 20,
        margin: isMobile ? "12px auto" : "24px auto",
      }}
    >
      {/* Header with logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        <img
          src="/logo.png"
          alt="Greatland"
          style={{ height: isMobile ? 44 : 60, width: "auto", display: "block" }}
        />
        <h1 style={{ margin: 0, fontSize: isMobile ? 28 : 34 }}>
          WO Confirmation Sheet
        </h1>
      </div>

      <p style={styles.subtitle}>
        Date → Company → Work Orders → People & hours → Export Vendor Entry
      </p>

      <button
        onClick={async () => {
          await fetch("/api/logout", { method: "POST" });
          window.location.href = "/pin";
        }}
        style={{ ...styles.buttonGhost, marginBottom: 12, width: isMobile ? "100%" : undefined }}
      >
        Log out
      </button>

      {loading && <p>Loading options…</p>}

      {err && (
        <div style={styles.err}>
          <strong>Error:</strong> {err}
        </div>
      )}

      {uiError && (
        <div style={styles.warn}>
          <strong>Fix needed:</strong> {uiError}
        </div>
      )}

      {!loading && opts && (
        <>
          {/* Date + Company */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 14,
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: 6 }}>Date</label>
              <input
                type="date"
                value={dateISO}
                onChange={(e) => setDateISO(e.target.value)}
                style={styles.input}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6 }}>Company</label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                style={styles.input}
              >
                <option value="">Select…</option>
                {companies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {company && (
                <div style={{ marginTop: 8, fontSize: 14, opacity: 0.85 }}>
                  PO: <strong>{opts.poByCompany?.[company]?.poNumber ?? "—"}</strong> / Item:{" "}
                  <strong>{opts.poByCompany?.[company]?.poItem ?? "—"}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Add WO */}
          <div style={{ marginTop: 18, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={addWorkOrderBlock}
              disabled={!company}
              style={{ ...styles.button, ...(company ? {} : styles.disabled), width: isMobile ? "100%" : undefined }}
            >
              + Add Work Order
            </button>
            {!company && <span style={{ opacity: 0.8 }}>Select a company first</span>}
          </div>

          {blocks.length === 0 && (
            <div style={{ marginTop: 14, padding: 12, border: "1px dashed #555", borderRadius: 10 }}>
              No work orders yet. Click <strong>+ Add Work Order</strong>.
            </div>
          )}

          {/* WO Blocks */}
          {blocks.map((b, bi) => {
            const selectedKey =
              b.woNumber && b.opNumber && b.workCenter
                ? `${b.woNumber}|${b.opNumber}|${b.workCenter}`
                : "";

            return (
              <div key={bi} style={styles.card}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                    flexDirection: isMobile ? "column" : "row",
                  }}
                >
                  <div style={{ flex: 1, width: "100%" }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                      Work Order (filtered by company)
                    </div>

                    <select
                      value={selectedKey}
                      onChange={(e) => onSelectWO(bi, e.target.value)}
                      style={styles.input}
                    >
                      <option value="">Select work order…</option>
                      {workOrdersForCompany.map((w) => {
                        const key = `${w.woNumber}|${w.opNumber}|${w.workCenter}`;
                        // Label: Header, Op Short Text, WO Number (nothing else)
                        const label = `${w.woHeader}, ${w.opShortText || `OP ${w.opNumber}`}, ${w.woNumber}`;
                        return (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        );
                      })}
                    </select>

                    {b.woNumber ? (
                      <div style={{ marginTop: 10, fontSize: 14, opacity: 0.85 }}>
                        WO: <strong>{b.woNumber}</strong> &nbsp; OP: <strong>{b.opNumber}</strong>
                        {b.opShortText ? ` — ${b.opShortText}` : ""} &nbsp; WC: <strong>{b.workCenter}</strong>
                      </div>
                    ) : (
                      <div style={{ marginTop: 10, fontSize: 14, opacity: 0.75 }}>
                        Select a work order to enable people rows.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => removeBlock(bi)}
                    style={{ ...styles.buttonDanger, width: isMobile ? "100%" : undefined }}
                  >
                    Remove
                  </button>
                </div>

                {/* People header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 14,
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>People</div>
                  <div style={{ fontSize: 14, opacity: 0.85 }}>
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
                        gridTemplateColumns: isMobile ? "1fr" : "1fr 160px 90px",
                        gap: 12,
                        marginTop: 12,
                        alignItems: "center",
                      }}
                    >
                      <select
                        value={r.employeeName}
                        onChange={(e) => updateRow(bi, ri, { employeeName: e.target.value })}
                        style={styles.input}
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
                        style={styles.input}
                        disabled={!b.woNumber}
                      />

                      <button
                        onClick={() => removeRow(bi, ri)}
                        disabled={!b.woNumber}
                        style={{
                          ...styles.buttonDanger,
                          width: isMobile ? "100%" : undefined,
                        }}
                      >
                        X
                      </button>
                    </div>
                  );
                })}

                <button
                  onClick={() => addPersonRow(bi)}
                  disabled={!b.woNumber}
                  style={{
                    ...styles.buttonGhost,
                    ...(b.woNumber ? {} : styles.disabled),
                    marginTop: 12,
                    width: isMobile ? "100%" : undefined,
                  }}
                >
                  + Add Another Person
                </button>
              </div>
            );
          })}

          {/* Totals + actions */}
          <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", fontSize: 18 }}>
            Total hours: <strong style={{ marginLeft: 10 }}>{grandTotal.toFixed(2)}</strong>
          </div>

          <div
            style={{
              marginTop: 14,
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={sendEmail}
              disabled={exporting || !company || blocks.length === 0}
              style={{
                ...styles.button,
                ...(exporting ? styles.disabled : {}),
                width: isMobile ? "100%" : undefined,
              }}
            >
              {exporting ? "Working…" : "Send Email"}
            </button>

            <button
              onClick={downloadToDevice}
              disabled={exporting || !company || blocks.length === 0}
              style={{
                ...styles.button,
                ...(exporting ? styles.disabled : {}),
                width: isMobile ? "100%" : undefined,
              }}
            >
              {exporting ? "Working…" : "Download"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
