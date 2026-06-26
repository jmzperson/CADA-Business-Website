"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell, Alert } from "@/components/auth-shell";

function InviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [invite, setInvite] = useState<{
    email: string;
    role: string;
    brand_name: string;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing invite token");
      return;
    }

    fetch(`/api/brands/staff/accept?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setInvite(data);
        }
      })
      .catch(() => setError("Failed to load invite"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/brands/staff/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to accept invite");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="Invalid invite">
        <Alert type="error">This invite link is invalid.</Alert>
        <Link href="/login" className="btn-secondary mt-4 inline-flex w-full">
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  if (error && !invite) {
    return (
      <AuthShell title="Invite unavailable">
        <Alert type="error">{error}</Alert>
        <Link href="/login" className="btn-secondary mt-4 inline-flex w-full">
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  if (!invite) {
    return (
      <AuthShell title="Loading invite…">
        <p className="text-sm text-ink-muted">Please wait.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Join ${invite.brand_name}`}
      subtitle={`You've been invited as ${invite.role === "admin" ? "an admin" : "a scanner"}`}
    >
      {error && <Alert type="error">{error}</Alert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input bg-surface-subtle" value={invite.email} disabled />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Create password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Joining…" : "Accept invite"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<AuthShell title="Loading…"><p className="text-sm text-ink-muted">Please wait.</p></AuthShell>}>
      <InviteForm />
    </Suspense>
  );
}
