"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell, Alert } from "@/components/auth-shell";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function afterVerifyPath() {
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      return next;
    }
    return "/dashboard?welcome=1";
  }

  async function resend() {
    setLoading(true);
    setMessage("");

    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ continue_url: afterVerifyPath() }),
    });

    const data = (await res.json()) as { message?: string; error?: string };
    if (!res.ok) {
      setMessage(data.error || "Could not send verification email. Please sign in again.");
    } else {
      setMessage(data.message || "Verification email sent. Check your inbox.");
    }
    setLoading(false);
  }

  async function checkVerified() {
    setLoading(true);
    const res = await fetch("/api/auth/session-status");
    const data = (await res.json()) as { email_verified?: boolean; error?: string };

    if (!res.ok) {
      setMessage(data.error || "Session expired. Please sign in again.");
      setLoading(false);
      return;
    }

    if (data.email_verified) {
      window.location.href = afterVerifyPath();
      return;
    }

    setMessage("Email not verified yet. Click the link in your inbox.");
    setLoading(false);
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle="We sent a confirmation link to your inbox. Verify before accessing the dashboard."
    >
      <Alert type="info">
        Check your spam folder if you don&apos;t see the email within a few minutes.
      </Alert>
      {message && (
        <Alert type={message.includes("sent") ? "success" : "info"}>{message}</Alert>
      )}
      <div className="space-y-3">
        <button type="button" className="btn-primary w-full" onClick={checkVerified} disabled={loading}>
          I&apos;ve verified my email
        </button>
        <button type="button" className="btn-secondary w-full" onClick={resend} disabled={loading}>
          Resend verification email
        </button>
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthShell title="Verify your email"><p className="text-sm text-ink-muted">Loading…</p></AuthShell>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
