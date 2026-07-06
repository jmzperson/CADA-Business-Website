"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell, Alert } from "@/components/auth-shell";

const CATEGORIES = [
  { value: "gym", label: "Gym & Fitness" },
  { value: "food", label: "Food & Beverage" },
  { value: "wellness", label: "Wellness & Spa" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
] as const;

type Eligibility =
  | { status: "loading" }
  | { status: "eligible"; email: string; emailVerified: boolean }
  | { status: "ineligible" }
  | { status: "unauthenticated" };

export default function BusinessProfilePage() {
  const router = useRouter();
  const [eligibility, setEligibility] = useState<Eligibility>({ status: "loading" });
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("other");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/brands/complete-profile")
      .then((r) => r.json())
      .then((data: { eligible?: boolean; reason?: string; redirect?: string; email?: string; email_verified?: boolean; error?: string }) => {
        if (data.error === "Unauthorized" || data.error?.includes("401")) {
          setEligibility({ status: "unauthenticated" });
          router.replace("/login");
          return;
        }
        if (data.eligible === false && data.redirect === "/dashboard") {
          router.replace("/dashboard");
          return;
        }
        setEligibility({
          status: "eligible",
          email: data.email ?? "",
          emailVerified: Boolean(data.email_verified),
        });
      })
      .catch(() => setEligibility({ status: "unauthenticated" }));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/brands/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName,
          category,
          website: website || undefined,
        }),
      });
      const data = await res.json() as {
        email_verification_required?: boolean;
        redirect?: string;
        message?: string;
        error?: string;
      };

      if (res.status === 409 && data.redirect === "/dashboard") {
        router.push("/dashboard");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      window.location.assign("/dashboard?welcome=1");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (eligibility.status === "loading") {
    return (
      <AuthShell title="Set up your business">
        <p className="text-sm text-ink-muted">Loading…</p>
      </AuthShell>
    );
  }

  if (eligibility.status !== "eligible") {
    return (
      <AuthShell title="Set up your business">
        <p className="text-sm text-ink-muted">Redirecting…</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Finish your partner profile"
      subtitle={`You're signed in as ${eligibility.email}. Tell us about your business.`}
      footer={
        <>
          Wrong account?{" "}
          <Link href="/api/auth/logout" className="font-display font-extrabold text-teal hover:underline">
            Sign out
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

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating profile…" : "Create partner profile"}
        </button>
      </form>
    </AuthShell>
  );
}
