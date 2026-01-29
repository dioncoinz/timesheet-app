"use client";

import { useState } from "react";

export default function PinPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Incorrect PIN");
        setLoading(false);
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#000",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          padding: 24,
          textAlign: "center",
          background: "#111",
          borderRadius: 12,
          boxShadow: "0 0 30px rgba(0,0,0,.6)",
        }}
      >
        {/* LOGO */}
        <img
          src="/logo"
          alt="Greatland"
          style={{
            maxWidth: 200,
            marginBottom: 20,
          }}
        />

        <h2 style={{ color: "#fff", marginBottom: 14 }}>
          WO Confirmation Sheet
        </h2>

        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Enter PIN"
          style={{
            width: "100%",
            padding: 14,
            fontSize: 18,
            marginBottom: 14,
            borderRadius: 8,
            border: "1px solid #444",
            background: "#000",
            color: "#fff",
          }}
        />

        <button
          onClick={submit}
          disabled={loading || !pin}
          style={{
            width: "100%",
            padding: 14,
            fontSize: 16,
            borderRadius: 8,
            background: "#444",
            color: "#fff",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Checking…" : "Continue"}
        </button>

        {error && (
          <p style={{ color: "crimson", marginTop: 14 }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
