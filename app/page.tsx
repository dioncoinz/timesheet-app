"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Person = { name: string; sapId: string; role: string };

type WorkOrder = {
  woNumber: string;
  opNumber: string;
  opShortText: string;
  woHeader: string;
  workCenter: string;
};

type ShutdownOption = {
  id: string;
  label: string;
};

type Options = {
  shutdowns: ShutdownOption[];
  selectedShutdown: string;
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
  manualEntry: boolean;
  manualWorkOrderText: string;
  minimized: boolean;
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

type PendingExportAction = "email" | "download" | null;

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

  buttonSuccess: {
    background: "#1f6b3b",
    border: "1px solid #2c8c4d",
    color: "#fff",
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

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 1000,
  } as React.CSSProperties,

  modalCard: {
    width: "100%",
    maxWidth: 560,
    background: "linear-gradient(#171717, #0c0c0c)",
    border: "1px solid #3a3a3a",
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
  } as React.CSSProperties,

};

export default function HomePage() {
  const EMPTY_BLOCK: WOBlock = {
    woNumber: "",
    opNumber: "",
    opShortText: "",
    woHeader: "",
    workCenter: "",
    manualEntry: false,
    manualWorkOrderText: "",
    minimized: false,
    rows: [{ employeeName: "", hours: "" }],
  };

  const [opts, setOpts] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [dateISO, setDateISO] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [shutdown, setShutdown] = useState("");
  const [company, setCompany] = useState("");

  // ✅ Start with ONE block
  const [blocks, setBlocks] = useState<WOBlock[]>([EMPTY_BLOCK]);

  const [exporting, setExporting] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const [emailSent, setEmailSent] = useState(false);
  const emailSentTimeoutRef = useRef<number | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingExportAction>(null);
  const [pendingLines, setPendingLines] = useState<ExportLine[] | null>(null);

  // Responsive flag
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 760);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    return () => {
      if (emailSentTimeoutRef.current) window.clearTimeout(emailSentTimeoutRef.current);
    };
  }, []);

  async function loadOptions(shutdownId?: string) {
    try {
      setLoading(true);
      setErr(null);

      const params = shutdownId
        ? `?shutdown=${encodeURIComponent(shutdownId)}`
        : "";
      const res = await fetch(`/api/options${params}`);
      const data = await res.json();
      if (!res.ok || data?.ok === false)
        throw new Error(data?.error ?? "Failed to load options");

      setOpts(data);
      setShutdown(data.selectedShutdown ?? "");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load options");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOptions();
  }, []);

  const shutdownOptions = useMemo(() => opts?.shutdowns ?? [], [opts]);
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

  // ✅ Reset when company changes (keep one empty block)
  useEffect(() => {
    setBlocks([EMPTY_BLOCK]);
    setUiError(null);
    setEmailSent(false);
    setPendingAction(null);
    setPendingLines(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function blockCompletedRows(b: WOBlock): number {
    return b.rows.filter(
      (r) => Boolean(r.employeeName) && Number.isFinite(parseHoursStrict(r.hours)) && parseHoursStrict(r.hours) > 0
    ).length;
  }

  function blockCanMinimize(b: WOBlock): boolean {
    return Boolean(b.woNumber || b.manualWorkOrderText.trim()) && blockCompletedRows(b) > 0;
  }

  function summarizeHoursByPerson(lines: ExportLine[]) {
    const totals = new Map<string, number>();
    for (const line of lines) {
      totals.set(line.employeeName, (totals.get(line.employeeName) ?? 0) + line.hours);
    }
    return Array.from(totals.entries())
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => a.name.localeCompare(b.name));
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
    setEmailSent(false);
    setPendingAction(null);
    setPendingLines(null);
    setBlocks((prev) => [
      ...prev,
        {
          woNumber: "",
          opNumber: "",
          opShortText: "",
          woHeader: "",
          workCenter: "",
          manualEntry: false,
          manualWorkOrderText: "",
          minimized: false,
          rows: [{ employeeName: "", hours: "" }],
        },
      ]);
  }

  function removeBlock(blockIndex: number) {
    setUiError(null);
    setEmailSent(false);
    setPendingAction(null);
    setPendingLines(null);
    setBlocks((prev) => prev.filter((_, i) => i !== blockIndex));
  }

  function toggleBlockMinimized(blockIndex: number) {
    setUiError(null);
    setEmailSent(false);
    setPendingAction(null);
    setPendingLines(null);
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIndex ? { ...b, minimized: !b.minimized } : b
      )
    );
  }

  function addPersonRow(blockIndex: number) {
    setUiError(null);
    setEmailSent(false);
    setPendingAction(null);
    setPendingLines(null);
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
    setEmailSent(false);
    setPendingAction(null);
    setPendingLines(null);
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

  function updateRow(blockIndex: number, rowIndex: number, patch: Partial<Row>) {
    setUiError(null);
    setEmailSent(false);
    setPendingAction(null);
    setPendingLines(null);
    setBlocks((prev) =>
      prev.map((b, i) => {
        if (i !== blockIndex) return b;

        const rows = b.rows.map((r, ri) =>
          ri === rowIndex ? { ...r, ...patch } : r
        );

        return { ...b, rows };
      })
    );
  }

  function onSelectWO(blockIndex: number, woKey: string) {
    setUiError(null);
    setEmailSent(false);
    setPendingAction(null);
    setPendingLines(null);

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
                manualEntry: false,
                manualWorkOrderText: "",
                minimized: false,
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
              manualEntry: false,
              manualWorkOrderText: "",
              minimized: false,
            }
          : b
      )
    );
  }

  function toggleManualWO(blockIndex: number, enabled: boolean) {
    setUiError(null);
    setEmailSent(false);
    setPendingAction(null);
    setPendingLines(null);
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIndex
          ? {
              ...b,
              manualEntry: enabled,
              manualWorkOrderText: enabled ? b.manualWorkOrderText : "",
              woNumber: enabled ? "" : b.woNumber,
              opNumber: enabled ? "" : b.opNumber,
              opShortText: enabled ? "" : b.opShortText,
              woHeader: enabled ? "" : b.woHeader,
              workCenter: enabled ? "" : b.workCenter,
              minimized: false,
            }
          : b
      )
    );
  }

  function updateManualWO(blockIndex: number, value: string) {
    setUiError(null);
    setEmailSent(false);
    setPendingAction(null);
    setPendingLines(null);
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIndex
          ? {
              ...b,
              manualWorkOrderText: value,
              woNumber: value.trim(),
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
    if (blocks.length === 0)
      return (setUiError("Add at least one work order."), null);

    const poInfo = opts.poByCompany?.[company] ?? { poNumber: "", poItem: "" };
    const lines: ExportLine[] = [];

    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi];

      const manualText = b.manualWorkOrderText.trim();
      if (b.manualEntry) {
        if (!manualText) {
          setUiError(`Work order block #${bi + 1}: Enter a work order or description.`);
          return null;
        }
      } else if (!b.woNumber || !b.opNumber || !b.workCenter) {
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
          setUiError(
            `Block #${bi + 1}, row #${ri + 1}: Enter valid hours (> 0).`
          );
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
          woNumber: b.manualEntry ? manualText : b.woNumber,
          opNumber: b.manualEntry ? "" : b.opNumber,
          workCenter: b.manualEntry ? "" : b.workCenter,
          poNumber: poInfo.poNumber ?? "",
          poItem: poInfo.poItem ?? "",
        });
      }
    }

    if (lines.length === 0)
      return (setUiError("No valid people/hours entered yet."), null);

    return lines;
  }

  function openExportConfirmation(action: PendingExportAction) {
    setUiError(null);
    setEmailSent(false);
    setPendingAction(null);
    setPendingLines(null);

    const lines = buildExportLines();
    if (!lines) return;

    setPendingLines(lines);
    setPendingAction(action);
  }

  function closeExportConfirmation() {
    setPendingAction(null);
    setPendingLines(null);
  }

  async function sendEmail(lines: ExportLine[]) {
    setUiError(null);
    setEmailSent(false);

    setExporting(true);
    try {
      const res = await fetch("/api/export/vendor-entry/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shutdown, lines }),
      });

      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || `Email failed (${res.status})`);

      setEmailSent(true);
      if (emailSentTimeoutRef.current) window.clearTimeout(emailSentTimeoutRef.current);
      emailSentTimeoutRef.current = window.setTimeout(() => setEmailSent(false), 3000);
    } catch (e: unknown) {
      setUiError(e instanceof Error ? e.message : "Email failed");
    } finally {
      setExporting(false);
    }
  }

  async function downloadToDevice(lines: ExportLine[]) {
    setUiError(null);
    setEmailSent(false);

    setExporting(true);
    try {
      const res = await fetch("/api/export/vendor-entry/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shutdown, lines }),
      });

      if (!res.ok) {
        const text = await res.text(); // ✅ safe for binary endpoints
        throw new Error(text || `Download failed (${res.status})`);
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
    } catch (e: unknown) {
      setUiError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setExporting(false);
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction || !pendingLines) return;

    const action = pendingAction;
    const lines = pendingLines;
    closeExportConfirmation();

    if (action === "email") {
      await sendEmail(lines);
      return;
    }

    await downloadToDevice(lines);
  }

  // Render
  const personHourSummary = pendingLines ? summarizeHoursByPerson(pendingLines) : [];

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

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => {
            window.location.href = "/admin";
          }}
          style={{
            ...styles.buttonGhost,
            width: isMobile ? "100%" : undefined,
          }}
        >
          Admin Dashboard
        </button>

        <button
          onClick={async () => {
            await fetch("/api/logout", { method: "POST" });
            window.location.href = "/pin";
          }}
          style={{
            ...styles.buttonGhost,
            width: isMobile ? "100%" : undefined,
          }}
        >
          Log out
        </button>
      </div>

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
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
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
              <label style={{ display: "block", marginBottom: 6 }}>Shutdown</label>
              <select
                value={shutdown}
                onChange={async (e) => {
                  const value = e.target.value;
                  setShutdown(value);
                  setCompany("");
                  await loadOptions(value);
                }}
                style={styles.input}
              >
                {shutdownOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
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

          {/* WO Blocks */}
          {blocks.map((b, bi) => {
            const selectedKey =
              b.woNumber && b.opNumber && b.workCenter
                ? `${b.woNumber}|${b.opNumber}|${b.workCenter}`
                : "";
            const completedRows = blockCompletedRows(b);
            const canMinimize = blockCanMinimize(b);

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
                      Work Order {bi + 1}
                    </div>

                    {b.minimized ? (
                      <div style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.6 }}>
                        <strong>{b.manualEntry ? "Manual work order entry" : b.woHeader || "Work order selected"}</strong>
                        <div>
                          WO: <strong>{b.manualEntry ? b.manualWorkOrderText || "—" : b.woNumber || "—"}</strong>
                          {!b.manualEntry && (
                            <>
                              &nbsp; OP: <strong>{b.opNumber || "—"}</strong>
                              {b.opShortText ? ` — ${b.opShortText}` : ""} &nbsp; WC: <strong>{b.workCenter || "—"}</strong>
                            </>
                          )}
                        </div>
                        <div>
                          People: <strong>{completedRows}</strong> &nbsp; Hours: <strong>{blockTotal(b).toFixed(2)}</strong>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            display: "flex",
                            gap: 12,
                            flexWrap: "wrap",
                            marginBottom: 10,
                            fontSize: 14,
                          }}
                        >
                          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="radio"
                              name={`wo-mode-${bi}`}
                              checked={!b.manualEntry}
                              onChange={() => toggleManualWO(bi, false)}
                            />
                            Select from list
                          </label>
                          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="radio"
                              name={`wo-mode-${bi}`}
                              checked={b.manualEntry}
                              onChange={() => toggleManualWO(bi, true)}
                            />
                            Enter manually (only if not found in list)
                          </label>
                        </div>

                        {b.manualEntry ? (
                          <>
                            <input
                              type="text"
                              value={b.manualWorkOrderText}
                              onChange={(e) => updateManualWO(bi, e.target.value)}
                              placeholder="Enter WO number or description"
                              style={styles.input}
                            />
                            <div style={{ marginTop: 10, fontSize: 14, opacity: 0.75 }}>
                              Manual entries will be included in the export so they can be tidied up after submission.
                            </div>
                          </>
                        ) : (
                          <>
                            <select
                              value={selectedKey}
                              onChange={(e) => onSelectWO(bi, e.target.value)}
                              style={styles.input}
                            >
                              <option value="">Select work order…</option>
                              {workOrdersForCompany.map((w) => {
                                const key = `${w.woNumber}|${w.opNumber}|${w.workCenter}`;
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
                                WO: <strong>{b.woNumber}</strong> &nbsp; OP:{" "}
                                <strong>{b.opNumber}</strong>
                                {b.opShortText ? ` — ${b.opShortText}` : ""} &nbsp; WC:{" "}
                                <strong>{b.workCenter}</strong>
                              </div>
                            ) : (
                              <div style={{ marginTop: 10, fontSize: 14, opacity: 0.75 }}>
                                Select a work order to enable people rows.
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      width: isMobile ? "100%" : undefined,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => toggleBlockMinimized(bi)}
                      disabled={!canMinimize}
                      style={{
                        ...styles.buttonGhost,
                        ...(canMinimize ? {} : styles.disabled),
                        width: isMobile ? "100%" : undefined,
                      }}
                    >
                      {b.minimized ? "Expand" : "Minimise"}
                    </button>

                    <button
                      onClick={() => removeBlock(bi)}
                      disabled={blocks.length === 1}
                      style={{
                        ...styles.buttonDanger,
                        ...(blocks.length === 1 ? styles.disabled : {}),
                        width: isMobile ? "100%" : undefined,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {!b.minimized && (
                  <>
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
                            disabled={!b.woNumber && !b.manualWorkOrderText.trim()}
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
                            disabled={!b.woNumber && !b.manualWorkOrderText.trim()}
                          />

                          <button
                            onClick={() => removeRow(bi, ri)}
                            disabled={!b.woNumber && !b.manualWorkOrderText.trim()}
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
                      disabled={!b.woNumber && !b.manualWorkOrderText.trim()}
                      style={{
                        ...styles.buttonGhost,
                        ...(b.woNumber || b.manualWorkOrderText.trim() ? {} : styles.disabled),
                        marginTop: 12,
                        width: isMobile ? "100%" : undefined,
                      }}
                    >
                      + Add Another Person
                    </button>
                  </>
                )}
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
              justifyContent: "space-between",
              alignItems: isMobile ? "stretch" : "flex-end",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                width: isMobile ? "100%" : undefined,
              }}
            >
              <button
                onClick={addWorkOrderBlock}
                disabled={!company}
                style={{
                  ...styles.button,
                  ...(company ? {} : styles.disabled),
                  width: isMobile ? "100%" : undefined,
                }}
              >
                + Add Work Order
              </button>
              {!company && <span style={{ opacity: 0.8 }}>Select a company first</span>}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                flexWrap: "wrap",
                width: isMobile ? "100%" : undefined,
              }}
            >
              <button
                onClick={() => openExportConfirmation("email")}
                disabled={exporting || !company || blocks.length === 0}
                style={{
                  ...styles.button,
                  ...(emailSent ? styles.buttonSuccess : {}),
                  ...(exporting ? styles.disabled : {}),
                  width: isMobile ? "100%" : undefined,
                }}
              >
                {exporting ? "Working…" : emailSent ? "✓ Email Sent" : "Send Email"}
              </button>

              <button
                onClick={() => openExportConfirmation("download")}
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
          </div>
        </>
      )}

      {pendingAction && pendingLines && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              {pendingAction === "email" ? "Confirm Email" : "Confirm Download"}
            </div>

            <div style={{ opacity: 0.85, marginBottom: 16, lineHeight: 1.5 }}>
              Review the total hours by person before you {pendingAction === "email" ? "send the email" : "download the file"}.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                fontSize: 14,
                marginBottom: 10,
                opacity: 0.85,
              }}
            >
              <div>Total rows: <strong>{pendingLines.length}</strong></div>
              <div>Total hours: <strong>{pendingLines.reduce((sum, line) => sum + line.hours, 0).toFixed(2)}</strong></div>
            </div>

            <div
              style={{
                border: "1px solid #3a3a3a",
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 110px",
                  gap: 12,
                  padding: "12px 14px",
                  background: "#1d1d1d",
                  fontWeight: 700,
                }}
              >
                <div>Person</div>
                <div style={{ textAlign: "right" }}>Hours</div>
              </div>

              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {personHourSummary.map((item) => (
                  <div
                    key={item.name}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 110px",
                      gap: 12,
                      padding: "12px 14px",
                      borderTop: "1px solid #2a2a2a",
                      alignItems: "center",
                    }}
                  >
                    <div>{item.name}</div>
                    <div style={{ textAlign: "right" }}>{item.hours.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={closeExportConfirmation}
                style={{
                  ...styles.buttonGhost,
                  width: isMobile ? "100%" : undefined,
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmPendingAction}
                style={{
                  ...styles.button,
                  width: isMobile ? "100%" : undefined,
                }}
              >
                {pendingAction === "email" ? "Confirm Send Email" : "Confirm Download"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

