"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChallengeForm } from "@/components/challenge-form";
import { ChallengeStatusBadge } from "@/components/challenge-status-badge";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/auth-shell";
import { toDatetimeLocal, type ChallengeFormValues } from "@/lib/challenge-form";
import type { ChallengeStatus } from "@/lib/challenges";

type Challenge = {
  id: string;
  title: string;
  description: string;
  habit_type: string;
  offer_headline: string;
  offer_code: string | null;
  status: ChallengeStatus;
  starts_at: string;
  ends_at: string | null;
  max_redemptions: number | null;
  enrolled_count: number;
  completion_count: number;
  redemption_count: number;
  submitted_at: string | null;
  rejection_reason: string | null;
};

export default function EditChallengePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [values, setValues] = useState<ChallengeFormValues | null>(null);
  const [recentRedemptions, setRecentRedemptions] = useState<
    { id: string; redeemed_at: string; staff_email: string; user_label: string | null }[]
  >([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const publishError = new URLSearchParams(window.location.search).get("publish_error");
    if (publishError) setError(publishError);
  }, []);

  const readOnlyFields = useMemo(() => {
    if (!challenge || challenge.status === "draft" || challenge.status === "rejected") {
      return undefined;
    }
    if (challenge.status === "pending_review") {
      return new Set<keyof ChallengeFormValues>([
        "title",
        "description",
        "habit_type",
        "offer_headline",
        "offer_code",
        "starts_at",
        "ends_at",
        "max_redemptions",
      ]);
    }
    if (challenge.status === "active") {
      return new Set<keyof ChallengeFormValues>([
        "title",
        "habit_type",
        "starts_at",
        "ends_at",
      ]);
    }
    return new Set<keyof ChallengeFormValues>([
      "title",
      "description",
      "habit_type",
      "offer_headline",
      "offer_code",
      "starts_at",
      "ends_at",
      "max_redemptions",
    ]);
  }, [challenge]);

  useEffect(() => {
    Promise.all([fetch(`/api/brands/challenges/${id}`), fetch("/api/brands/me")])
      .then(async ([cRes, meRes]) => {
        const cData = await cRes.json();
        const meData = await meRes.json();

        if (!cRes.ok) {
          setError(cData.error || "Challenge not found");
          return;
        }

        setIsAdmin(meData.staff?.role === "admin");
        const c = cData.challenge as Challenge;
        setChallenge(c);
        setValues({
          title: c.title,
          description: c.description,
          habit_type: c.habit_type,
          offer_headline: c.offer_headline,
          offer_code: c.offer_code || "",
          starts_at: toDatetimeLocal(c.starts_at),
          ends_at: c.ends_at ? toDatetimeLocal(c.ends_at) : "",
          max_redemptions: c.max_redemptions ? String(c.max_redemptions) : "",
        });

        if (c.status === "active" || c.status === "ended") {
          fetch(`/api/brands/challenges/${id}/redemptions?all_time=true&page_size=5`)
            .then((r) => r.json())
            .then((json) => setRecentRedemptions(json.redemptions || []))
            .catch(() => setRecentRedemptions([]));
        }
      })
      .catch(() => setError("Failed to load challenge"));
  }, [id]);

  async function save(): Promise<boolean> {
    if (!values || !isAdmin) return false;
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        description: values.description,
        offer_headline: values.offer_headline,
        offer_code: values.offer_code || null,
        max_redemptions: values.max_redemptions ? Number(values.max_redemptions) : null,
      };

      if (challenge?.status === "draft" || challenge?.status === "rejected") {
        Object.assign(payload, {
          title: values.title,
          habit_type: values.habit_type,
          starts_at: values.starts_at,
          ends_at: values.ends_at || null,
        });
      }

      const res = await fetch(`/api/brands/challenges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Save failed");
        return false;
      }

      setChallenge(data.challenge);
      setMessage("Changes saved.");
      return true;
    } catch {
      setError("Something went wrong");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function submitForReview() {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (challenge?.status === "draft" || challenge?.status === "rejected") {
        const saved = await save();
        if (!saved) return;
        setLoading(true);
      }

      const res = await fetch(`/api/brands/challenges/${id}/publish`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Submit failed");
        return;
      }

      setChallenge(data.challenge);
      setMessage(data.message || "Submitted for CADA approval.");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function endChallenge() {
    if (!confirm("End this challenge? It will no longer be visible in the app.")) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/brands/challenges/${id}/end`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to end challenge");
        return;
      }

      setChallenge(data.challenge);
      setMessage(data.message || "Challenge ended.");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function deleteDraft() {
    if (!confirm("Delete this draft? This cannot be undone.")) return;

    setLoading(true);
    const res = await fetch(`/api/brands/challenges/${id}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Delete failed");
      setLoading(false);
      return;
    }

    router.push("/dashboard/challenges");
    router.refresh();
  }

  if (error && !challenge) {
    return (
      <div>
        <Alert type="error">{error}</Alert>
        <Link href="/dashboard/challenges" className="mt-4 inline-block text-teal hover:underline">
          Back to challenges
        </Link>
      </div>
    );
  }

  if (!challenge || !values) {
    return <p className="text-ink-muted">Loading challenge…</p>;
  }

  const canEdit =
    isAdmin &&
    challenge.status !== "ended" &&
    challenge.status !== "pending_review";
  const isDraft = challenge.status === "draft";
  const isRejected = challenge.status === "rejected";
  const isPending = challenge.status === "pending_review";
  const isActive = challenge.status === "active";
  const canSubmit = isDraft || isRejected;

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard/challenges"
        className="font-display text-sm font-extrabold text-teal hover:underline"
      >
        ← Back to challenges
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <PageHeader
              eyebrow="Campaigns"
              title={isAdmin ? "Manage challenge" : "Challenge details"}
            />
            <ChallengeStatusBadge status={challenge.status} />
          </div>
          <p className="mt-1 font-medium text-ink-light">
            {isDraft && "Draft — not visible in the app until CADA approves."}
            {isPending &&
              "Submitted to CADA for approval. You'll be notified when it's live."}
            {isRejected && "Rejected — update and resubmit for review."}
            {isActive && "Active — visible to CADA users."}
            {challenge.status === "ended" && "Ended — archived and hidden from the app."}
          </p>
          {isPending && challenge.submitted_at && (
            <p className="mt-1 text-xs font-medium text-ink-light">
              Submitted {new Date(challenge.submitted_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {isPending && (
        <div className="mt-4">
          <Alert type="info">
            CADA reviews sponsored challenges before they appear in the app. This usually takes 1–2
            business days.
          </Alert>
        </div>
      )}

      {isRejected && challenge.rejection_reason && (
        <div className="mt-4">
          <Alert type="error">
            <span className="font-medium">CADA feedback: </span>
            {challenge.rejection_reason}
          </Alert>
        </div>
      )}

      {(error) && (
        <div className="mt-4">
          <Alert type="error">{error}</Alert>
        </div>
      )}
      {message && (
        <div className="mt-4">
          <Alert type="success">{message}</Alert>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-surface-border bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Enrolled</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{challenge.enrolled_count}</p>
        </div>
        <div className="rounded-lg border border-surface-border bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Completed</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{challenge.completion_count}</p>
        </div>
        <div className="rounded-lg border border-surface-border bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Redemptions</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{challenge.redemption_count}</p>
          {challenge.max_redemptions != null && (
            <p className="mt-0.5 text-xs font-medium text-ink-light">
              of {challenge.max_redemptions} max
            </p>
          )}
        </div>
      </div>

      {(isActive || challenge.status === "ended") && (
        <div className="card mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-extrabold text-ink">Recent redemptions</h2>
            {challenge.redemption_count > 0 && (
              <Link
                href={`/dashboard/redemptions?challenge_id=${id}`}
                className="font-display text-sm font-extrabold text-teal hover:underline"
              >
                View all
              </Link>
            )}
          </div>
          {recentRedemptions.length === 0 ? (
            <p className="mt-3 text-sm font-medium text-ink-light">
              No redemptions yet. They appear here when staff scan a customer QR.
            </p>
          ) : (
            <div className="table-shell mt-4">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 font-display font-extrabold">Redeemed at</th>
                    <th className="px-4 py-2 font-display font-extrabold">Staff</th>
                    <th className="px-4 py-2 font-display font-extrabold">User</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRedemptions.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2 font-medium text-ink">
                        {new Date(row.redeemed_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-ink-muted">{row.staff_email}</td>
                      <td className="px-4 py-2 text-ink-muted">{row.user_label ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card mt-6">
        <ChallengeForm
          values={values}
          onChange={setValues}
          disabled={!canEdit}
          readOnlyFields={readOnlyFields}
        />

        {isAdmin && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-surface-border pt-6">
            {canEdit && (
              <button type="button" className="btn-secondary" onClick={save} disabled={loading}>
                {loading ? "Saving…" : "Save changes"}
              </button>
            )}
            {canSubmit && (
              <>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={submitForReview}
                  disabled={loading}
                >
                  Submit for review
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                  onClick={deleteDraft}
                  disabled={loading}
                >
                  Delete draft
                </button>
              </>
            )}
            {isActive && (
              <button
                type="button"
                className="btn-secondary border-amber-200 text-amber-800 hover:bg-amber-50"
                onClick={endChallenge}
                disabled={loading}
              >
                End challenge
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
