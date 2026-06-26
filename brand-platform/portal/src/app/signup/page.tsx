"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell, Alert } from "@/components/auth-shell";
import { BRAND_CATEGORIES } from "@/lib/api";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    business_name: searchParams.get("business_name") || "",
    email: searchParams.get("email") || "",
    password: "",
    website: "",
    category: "other",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let logo_url: string | undefined;

      const res = await fetch("/api/brands/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      if (logoFile && data.brand?.id) {
        const fd = new FormData();
        fd.append("file", logoFile);
        const logoRes = await fetch("/api/brands/logo", { method: "POST", body: fd });
        if (logoRes.ok) {
          const logoData = await logoRes.json();
          logo_url = logoData.logo_url;
          await fetch("/api/brands/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logo_url }),
          });
        }
      }

      router.push(data.email_verification_required ? "/verify-email" : "/dashboard?welcome=1");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Partner with CADA"
      subtitle="Create your brand account to run sponsored challenges"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-teal hover:underline">
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
            className="input"
            value={form.business_name}
            onChange={(e) => update("business_name", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Contact email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            required
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
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div>
          <label className="label" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            className="input"
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
          >
            {BRAND_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="website">
            Website <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id="website"
            type="url"
            className="input"
            placeholder="https://"
            value={form.website}
            onChange={(e) => update("website", e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="logo">
            Logo <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id="logo"
            type="file"
            accept="image/*"
            className="input py-2 file:mr-3 file:rounded file:border-0 file:bg-teal-light file:px-3 file:py-1 file:text-sm file:font-medium file:text-teal-dark"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
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
    <Suspense fallback={<AuthShell title="Partner with CADA"><p className="text-sm text-ink-muted">Loading…</p></AuthShell>}>
      <SignupForm />
    </Suspense>
  );
}
