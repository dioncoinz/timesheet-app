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

      if (!res.ok) {
        setError("Incorrect PIN");
        setLoading(false);
        return;
      }

      // IMPORTANT:
      // Force a full page reload so middleware sees the cookie
      window.location.href = "/";
    } catch (e) {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 360,
        margin: "100px auto",
        padding: 20,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 12 }}>Enter PIN</h1>

      <input
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="PIN"
        style={{
          width: "100%",
          padding: 12,
          fontSize: 18,
          marginBottom: 12,
        }}
      />

      <button
        onClick={submit}
        disabled={loading || !pin}
        style={{
          width: "100%",
          padding: 12,
          fontSize: 16,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Checking…" : "Continue"}
      </button>

      {error && (
        <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>
      )}
    </main>
  );
}
