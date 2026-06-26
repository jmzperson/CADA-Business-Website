"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type QueueChallenge = {
  id: string;
  title: string;
  habit_label: string;
  offer_headline: string;
  brand_name: string;
  submitted_at: string | null;
  status: string;
};

function AdminChallengesInner() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [challenges, setChallenges] = useState<QueueChallenge[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    const fromUrl = searchParams.get("token");
    const stored =
      typeof window !== "undefined" ? sessionStorage.getItem("cada_admin_token") : null;
    const t = fromUrl || stored || "";
    if (fromUrl) sessionStorage.setItem("cada_admin_token", fromUrl);
    setToken(t);
  }, [searchParams]);

  function loadQueue() {
    if (!token) return;
    setLoading(true);
    fetch(`/api/admin/challenges?status=pending_review&token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setChallenges(json.challenges || []);
      })
      .catch(() => setError("Failed to load queue"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function approve(id: string) {
    const res = await fetch(
      `/api/admin/challenges/${id}/approve?token=${encodeURIComponent(token)}`,
      { method: "POST" }
    );
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Approve failed");
      return;
    }
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  }

  async function reject(id: string) {
    const res = await fetch(
      `/api/admin/challenges/${id}/reject?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason || undefined }),
      }
    );
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Reject failed");
      return;
    }
    setRejectId(null);
    setRejectReason("");
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  }

  if (!token) {
    return (
      <div className="portal-main">
        <div className="card max-w-md">
          <h1 className="font-display text-2xl font-extrabold text-ink">Challenge approvals</h1>
          <p className="mt-2 text-sm font-medium text-ink-light">
            CADA internal queue. Open with{" "}
            <code className="text-xs">?token=YOUR_CADA_ADMIN_TOKEN</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-main">
      <p className="font-display text-xs font-extrabold uppercase tracking-wide text-teal">Admin</p>
      <h1 className="font-display text-3xl font-extrabold text-ink">Challenge approvals</h1>
      <p className="mt-1 font-medium text-ink-light">
        {challenges.length} pending · CADA admin
      </p>

      {error && <div className="alert-error mt-4">{error}</div>}

      <div className="table-shell mt-6">
        {loading ? (
          <p className="p-6 text-sm font-medium text-ink-light">Loading…</p>
        ) : challenges.length === 0 ? (
          <p className="p-8 text-center text-sm font-medium text-ink-light">
            No challenges pending review.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 font-display font-extrabold">Brand</th>
                <th className="px-4 py-3 font-display font-extrabold">Challenge</th>
                <th className="px-4 py-3 font-display font-extrabold">Offer</th>
                <th className="px-4 py-3 font-display font-extrabold">Submitted</th>
                <th className="px-4 py-3 font-display font-extrabold" />
              </tr>
            </thead>
            <tbody>
              {challenges.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-display font-extrabold text-ink">{c.brand_name}</td>
                  <td className="px-4 py-3">
                    <div className="font-display font-extrabold text-ink">{c.title}</div>
                    <div className="text-xs font-medium text-ink-light">{c.habit_label}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-ink-light">{c.offer_headline}</td>
                  <td className="px-4 py-3 font-medium text-ink-light">
                    {c.submitted_at ? new Date(c.submitted_at).toLocaleString() : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      className="btn-primary mr-2 px-3 py-2 text-xs"
                      onClick={() => approve(c.id)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn-secondary px-3 py-2 text-xs"
                      onClick={() => setRejectId(c.id)}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
              <button type="button" className="btn-primary flex-1" onClick={() => reject(rejectId)}>
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
