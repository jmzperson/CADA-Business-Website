"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChallengeForm } from "@/components/challenge-form";
import { emptyChallengeForm } from "@/lib/challenge-form";
import { Alert } from "@/components/auth-shell";
import { PageHeader } from "@/components/page-header";

export default function NewChallengePage() {
  const router = useRouter();
  const [values, setValues] = useState(emptyChallengeForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent, publish = false) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        title: values.title,
        description: values.description,
        habit_type: values.habit_type,
        offer_headline: values.offer_headline,
        offer_code: values.offer_code || null,
        starts_at: values.starts_at,
        ends_at: values.ends_at || null,
        max_redemptions: values.max_redemptions ? Number(values.max_redemptions) : null,
      };

      const res = await fetch("/api/brands/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create challenge");
        return;
      }

      const id = data.challenge.id;

      if (publish) {
        const pubRes = await fetch(`/api/brands/challenges/${id}/publish`, { method: "POST" });
        const pubData = await pubRes.json();
        if (!pubRes.ok) {
          router.push(`/dashboard/challenges/${id}/edit?publish_error=${encodeURIComponent(pubData.error || "")}`);
          return;
        }
      }

      router.push(`/dashboard/challenges/${id}/edit`);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard/challenges"
        className="font-display text-sm font-extrabold text-teal hover:underline"
      >
        ← Back to challenges
      </Link>
      <div className="mt-4">
        <PageHeader
          eyebrow="Campaigns"
          title="New challenge"
          description="Save as draft, then submit for CADA approval. Challenges are not visible in the app until approved."
        />
      </div>

      {error && (
        <div className="mt-4">
          <Alert type="error">{error}</Alert>
        </div>
      )}

      <form
        onSubmit={(e) => handleSubmit(e, false)}
        className="card mt-6"
      >
        <ChallengeForm values={values} onChange={setValues} />
        <div className="mt-6 flex flex-wrap gap-3 border-t border-surface-border pt-6">
          <button type="submit" className="btn-secondary" disabled={loading}>
            {loading ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={loading}
            onClick={(e) => handleSubmit(e, true)}
          >
            {loading ? "Submitting…" : "Save & submit for review"}
          </button>
        </div>
      </form>
    </div>
  );
}
