"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell, Alert } from "@/components/auth-shell";

const CATEGORIES = [
  { value: "gym", label: "Gym & Fitness" },
  { value: "food", label: "Food & Beverage" },
  { value: "wellness", label: "Wellness & Spa" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
] as const;

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [category, setCategory] = useState("other");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/brands/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName,
          email,
          password,
          category,
          website: website || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      if (data.email_verification_required) {
        const verifyUrl = next
          ? `/verify-email?next=${encodeURIComponent(next)}`
          : "/verify-email";
        router.push(verifyUrl);
      } else {
        router.push(next);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your brand account"
      subtitle="Join CADA Partners and start running challenges"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-display font-extrabold text-teal hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {error && <Alert type="error">{error}</Alert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="business_name">
            Business name
          </label>
          <input
            id="business_name"
            type="text"
            className="input"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            autoComplete="organization"
            placeholder="Acme Gym"
          />
        </div>

        <div>
          <label className="label" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="website">
            Website <span className="text-ink-muted font-normal">(optional)</span>
          </label>
          <input
            id="website"
            type="url"
            className="input"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            autoComplete="url"
            placeholder="https://yourbrand.com"
          />
        </div>

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
            placeholder="you@yourbrand.com"
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label className="label" htmlFor="confirm">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Create your brand account">
          <p className="text-sm text-ink-muted">Loading…</p>
        </AuthShell>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
