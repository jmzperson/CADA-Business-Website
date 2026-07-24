"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell, Alert } from "@/components/auth-shell";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const emailParam = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      if (data.needs_business_profile || data.redirect === "/signup/business") {
        window.location.assign("/signup/business");
        return;
      }

      if (data.cada_admin || data.redirect === "/admin/challenges") {
        window.location.assign("/admin/challenges");
        return;
      }

      const destination =
        next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      window.location.assign(destination);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Partners and CADA admins use the same sign-in. Admins go straight to challenge review."
      footer={
        <>
          Brand new to CADA Partners?{" "}
          <Link href="/signup" className="font-display font-extrabold text-teal hover:underline">
            Create a partner account
          </Link>
        </>
      }
    >
      {searchParams.get("registered") === "1" && (
        <Alert type="success">Account created. Sign in with your email and password.</Alert>
      )}
      {searchParams.get("reset") === "1" && (
        <Alert type="success">Password updated. Sign in with your new password.</Alert>
      )}
      {error && <Alert type="error">{error}</Alert>}
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
            autoComplete="email"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0" htmlFor="password">
              Password
            </label>
            <Link href="/forgot-password" className="font-display text-xs font-extrabold text-teal hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell title="Sign in"><p className="text-sm text-ink-muted">Loading…</p></AuthShell>}>
      <LoginForm />
    </Suspense>
  );
}
