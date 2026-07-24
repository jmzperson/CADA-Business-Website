"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type QueueChallenge = {
  id: string;
  title: string;
  description: string;
  habit_label: string;
  offer_headline: string;
  offer_code: string | null;
  starts_at: string;
  ends_at: string | null;
  join_window_days: number | null;
  max_redemptions: number | null;
  brand_name: string;
  submitted_at: string | null;
  status: string;
};

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AdminChallengesInner() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [challenges, setChallenges] = useState<QueueChallenge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    const fromUrl = searchParams.get("token");
    const stored =
      typeof window !== "undefined" ? sessionStorage.getItem("cada_admin_token") : null;
    const t = fromUrl || stored || "";
    if (fromUrl) sessionStorage.setItem("cada_admin_token", fromUrl);
    setToken(t || null);
    setAuthReady(true);
  }, [searchParams]);

  function queueUrl(path: string) {
    if (!token) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}token=${encodeURIComponent(token)}`;
  }

  function loadQueue() {
    if (!authReady) return;
    setLoading(true);
    setError("");
    fetch(queueUrl("/api/admin/challenges?status=pending_review"), {
      credentials: "include",
    })
      .then(async (r) => {
        const json = await r.json();
        if (r.status === 401) {
          setAuthorized(false);
          setChallenges([]);
          return;
        }
        if (json.error) {
          setError(json.error);
          setAuthorized(false);
          return;
        }
        setAuthorized(true);
        const next = (json.challenges || []) as QueueChallenge[];
        setChallenges(next);
        setSelectedId((prev) => {
          if (prev && next.some((c) => c.id === prev)) return prev;
          return next[0]?.id ?? null;
        });
      })
      .catch(() => setError("Failed to load queue"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, token]);

  const selected = challenges.find((c) => c.id === selectedId) ?? null;

  async function approve(id: string) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(queueUrl(`/api/admin/challenges/${id}/approve`), {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to post challenge");
        return;
      }
      setMessage(json.message || "Challenge posted to the CADA app.");
      setChallenges((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Failed to post challenge");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(queueUrl(`/api/admin/challenges/${id}/reject`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Reject failed");
        return;
      }
      setRejectId(null);
      setRejectReason("");
      setMessage("Challenge rejected.");
      setChallenges((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!authReady || loading) {
    return (
      <div className="portal-main">
        <p className="text-sm font-medium text-ink-light">Loading…</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="portal-main">
        <div className="card max-w-md">
          <h1 className="font-display text-2xl font-extrabold text-ink">Challenge approvals</h1>
          <p className="mt-2 text-sm font-medium text-ink-light">
            Sign in with your CADA admin account to review pending partner challenges and post
            them to the app.
          </p>
          {error && <div className="alert-error mt-4">{error}</div>}
          <Link
            href={`/login?next=${encodeURIComponent("/admin/challenges")}`}
            className="btn-primary mt-6 inline-flex"
          >
            Sign in as admin
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-main">
      <p className="font-display text-xs font-extrabold uppercase tracking-wide text-teal">Admin</p>
      <h1 className="font-display text-3xl font-extrabold text-ink">Review & post challenges</h1>
      <p className="mt-1 font-medium text-ink-light">
        {challenges.length} pending · Approve posts the challenge live in the CADA app
      </p>

      {error && <div className="alert-error mt-4">{error}</div>}
      {message && <div className="alert-success mt-4">{message}</div>}

      {challenges.length === 0 ? (
        <div className="table-shell mt-6">
          <p className="p-8 text-center text-sm font-medium text-ink-light">
            No challenges pending review.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="table-shell overflow-hidden">
            <ul className="divide-y divide-border">
              {challenges.map((c) => {
                const active = c.id === selectedId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`w-full px-4 py-4 text-left transition ${
                        active ? "bg-sky/60" : "hover:bg-sky/30"
                      }`}
                      onClick={() => setSelectedId(c.id)}
                    >
                      <div className="font-display text-sm font-extrabold text-ink">{c.brand_name}</div>
                      <div className="mt-0.5 font-medium text-ink">{c.title}</div>
                      <div className="mt-1 text-xs font-medium text-ink-light">
                        {c.habit_label} · {c.submitted_at ? formatWhen(c.submitted_at) : "—"}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {selected && (
            <div className="card">
              <p className="font-display text-xs font-extrabold uppercase tracking-wide text-teal">
                Review
              </p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-ink">{selected.title}</h2>
              <p className="mt-1 text-sm font-medium text-ink-light">{selected.brand_name}</p>

              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="font-display text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                    Linked habit
                  </dt>
                  <dd className="mt-1 font-medium text-ink">{selected.habit_label}</dd>
                </div>
                {selected.description ? (
                  <div>
                    <dt className="font-display text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                      Description
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap font-medium text-ink">
                      {selected.description}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="font-display text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                    Offer
                  </dt>
                  <dd className="mt-1 font-medium text-ink">{selected.offer_headline}</dd>
                  {selected.offer_code ? (
                    <dd className="mt-1 text-ink-light">Code: {selected.offer_code}</dd>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="font-display text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                      Starts
                    </dt>
                    <dd className="mt-1 font-medium text-ink">{formatWhen(selected.starts_at)}</dd>
                  </div>
                  <div>
                    <dt className="font-display text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                      Ends
                    </dt>
                    <dd className="mt-1 font-medium text-ink">{formatWhen(selected.ends_at)}</dd>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="font-display text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                      Time to join
                    </dt>
                    <dd className="mt-1 font-medium text-ink">
                      {selected.join_window_days != null
                        ? `${selected.join_window_days} day${selected.join_window_days === 1 ? "" : "s"}`
                        : "Until challenge ends"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-display text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                      Max redemptions
                    </dt>
                    <dd className="mt-1 font-medium text-ink">
                      {selected.max_redemptions ?? "Unlimited"}
                    </dd>
                  </div>
                </div>
                <div>
                  <dt className="font-display text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                    Submitted
                  </dt>
                  <dd className="mt-1 font-medium text-ink">{formatWhen(selected.submitted_at)}</dd>
                </div>
              </dl>

              <div className="mt-8 flex flex-wrap gap-3 border-t border-surface-border pt-6">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busyId === selected.id}
                  onClick={() => approve(selected.id)}
                >
                  {busyId === selected.id ? "Posting…" : "Approve & post to app"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busyId === selected.id}
                  onClick={() => setRejectId(selected.id)}
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="card w-full max-w-md">
            <h2 className="font-display text-lg font-extrabold">Reject challenge</h2>
            <p className="mt-1 text-sm font-medium text-ink-light">
              Optional reason shown to the brand.
            </p>
            <textarea
              className="input mt-4 min-h-[88px] resize-y"
              placeholder="e.g. Offer copy needs clearer terms"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={busyId === rejectId}
                onClick={() => reject(rejectId)}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  setRejectId(null);
                  setRejectReason("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminChallengesPage() {
  return (
    <Suspense fallback={<p className="portal-main text-sm font-medium text-ink-light">Loading…</p>}>
      <AdminChallengesInner />
    </Suspense>
  );
}
