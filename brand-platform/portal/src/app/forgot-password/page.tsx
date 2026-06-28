"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell, Alert } from "@/components/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = (await res.json()) as { message?: string; error?: string };
    if (!res.ok) {
      setError(data.error || "Failed to send reset email");
    } else {
      setMessage(data.message || "If an account exists for this email, you'll receive a reset link shortly.");
    }
    setLoading(false);
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your email and we'll send a reset link"
      footer={
        <Link href="/login" className="font-medium text-teal hover:underline">
          Back to sign in
        </Link>
      }
    >
      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </AuthShell>
  );
}
