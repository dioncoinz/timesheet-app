"use client";

import { useState } from "react";

export default function PinPage() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    const clean = pin.trim();
    if (!clean) return setMsg("Enter a PIN.");

    setLoading(true);
    try {
      const res = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: clean }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok !== true) {
        setMsg(data?.error ?? "Invalid PIN");
        return;
      }

      window.location.href = "/";
    } catch (e: any) {
      setMsg(e?.message ?? "PIN check failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#000",
        color: "#fff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, border: "1px solid #333", borderRadius: 12, padding: 18 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>Enter PIN</h1>
        <p style={{ marginTop: 8, opacity: 0.8 }}>Enter your PIN to continue.</p>

        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          style={{
            width: "100%",
            padding: 14,
            fontSize: 18,
            marginTop: 12,
            borderRadius: 10,
            border: "1px solid #444",
            background: "#111",
            color: "#fff",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />

        <button
          onClick={submit}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 12,
            padding: 14,
            fontSize: 18,
            borderRadius: 10,
            border: "1px solid #555",
            background: loading ? "#333" : "#fff",
            color: "#000",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {loading ? "Checking…" : "Unlock"}
        </button>

        {msg && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "#2a1a1a", border: "1px solid #663" }}>
            {msg}
          </div>
        )}
      </div>
    </main>
  );
}
