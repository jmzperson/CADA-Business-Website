"use client";

import { useEffect, useState } from "react";
import { BRAND_CATEGORIES } from "@/lib/api";
import { Alert } from "@/components/auth-shell";
import { PageHeader } from "@/components/page-header";

type Brand = {
  name: string;
  website: string | null;
  category: string;
  logo_url: string | null;
  offer_default_copy: string | null;
  primary_address: string | null;
};

export default function ProfilePage() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [role, setRole] = useState<string>("");
  const [form, setForm] = useState<Brand>({
    name: "",
    website: "",
    category: "other",
    logo_url: "",
    offer_default_copy: "",
    primary_address: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    fetch("/api/brands/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.brand) {
          setBrand(data.brand);
          setForm({
            name: data.brand.name || "",
            website: data.brand.website || "",
            category: data.brand.category || "other",
            logo_url: data.brand.logo_url || "",
            offer_default_copy: data.brand.offer_default_copy || "",
            primary_address: data.brand.primary_address || "",
          });
          setRole(data.staff?.role || "");
          setReadOnly(data.staff?.role !== "admin");
        }
      });
  }, []);

  function update(field: keyof Brand, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;

    setError("");
    setMessage("");
    setLoading(true);

    try {
      let logo_url = form.logo_url;

      if (logoFile) {
        const fd = new FormData();
        fd.append("file", logoFile);
        const logoRes = await fetch("/api/brands/logo", { method: "POST", body: fd });
        const logoData = await logoRes.json();
        if (!logoRes.ok) {
          setError(logoData.error || "Logo upload failed");
          setLoading(false);
          return;
        }
        logo_url = logoData.logo_url;
      }

      const res = await fetch("/api/brands/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          website: form.website,
          category: form.category,
          logo_url,
          offer_default_copy: form.offer_default_copy,
          primary_address: form.primary_address,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Update failed");
        return;
      }

      setMessage("Profile updated successfully.");
      setLogoFile(null);
      if (data.brand) {
        setForm({
          name: data.brand.name || "",
          website: data.brand.website || "",
          category: data.brand.category || "other",
          logo_url: data.brand.logo_url || "",
          offer_default_copy: data.brand.offer_default_copy || "",
          primary_address: data.brand.primary_address || "",
        });
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!brand) {
    return <p className="text-ink-muted">Loading profile…</p>;
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow="Settings"
        title="Brand profile"
        description={
          readOnly
            ? "View your brand details. Contact an admin to make changes."
            : "Update your business information visible to CADA users."
        }
      />

      {readOnly && (
        <div className="mt-4">
          <Alert type="info">You are signed in as {role}. Profile editing is admin-only.</Alert>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Alert type="error">{error}</Alert>
        </div>
      )}
      {message && (
        <div className="mt-4">
          <Alert type="success">{message}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card mt-6 space-y-5">
        {form.logo_url && (
          <div>
            <p className="label">Current logo</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.logo_url}
              alt="Brand logo"
              className="h-16 w-16 rounded-lg border border-surface-border object-cover"
            />
          </div>
        )}

        <div>
          <label className="label" htmlFor="name">
            Business name
          </label>
          <input
            id="name"
            className="input"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            disabled={readOnly}
            required
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
            disabled={readOnly}
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
            Website
          </label>
          <input
            id="website"
            type="url"
            className="input"
            value={form.website || ""}
            onChange={(e) => update("website", e.target.value)}
            disabled={readOnly}
            placeholder="https://"
          />
        </div>

        <div>
          <label className="label" htmlFor="address">
            Primary address
          </label>
          <input
            id="address"
            className="input"
            value={form.primary_address || ""}
            onChange={(e) => update("primary_address", e.target.value)}
            disabled={readOnly}
          />
        </div>

        <div>
          <label className="label" htmlFor="offer_copy">
            Default offer copy
          </label>
          <textarea
            id="offer_copy"
            className="input min-h-[88px] resize-y"
            value={form.offer_default_copy || ""}
            onChange={(e) => update("offer_default_copy", e.target.value)}
            disabled={readOnly}
            placeholder="e.g. First class free for new CADA members"
          />
        </div>

        {!readOnly && (
          <div>
            <label className="label" htmlFor="logo">
              Upload logo
            </label>
            <input
              id="logo"
              type="file"
              accept="image/*"
              className="input py-2"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            />
          </div>
        )}

        {!readOnly && (
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Saving…" : "Save changes"}
          </button>
        )}
      </form>
    </div>
  );
}
