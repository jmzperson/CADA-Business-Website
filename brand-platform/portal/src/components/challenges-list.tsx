"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChallengeStatusBadge } from "@/components/challenge-status-badge";
import { PageHeader } from "@/components/page-header";
import { habitLabel } from "@/lib/challenge-form";
import type { ChallengeStatus } from "@/lib/challenges";

type Challenge = {
  id: string;
  title: string;
  habit_type: string;
  status: ChallengeStatus;
  starts_at: string;
  ends_at: string | null;
  enrolled_count: number;
  completion_count: number;
  redemption_count: number;
};

export function ChallengesList({ isAdmin }: { isAdmin: boolean }) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/brands/challenges")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setChallenges(data.challenges || []);
      })
      .catch(() => setError("Failed to load challenges"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="Campaigns"
          title="Challenges"
          description="Sponsored habit campaigns visible to CADA users after CADA approval."
        />
        {isAdmin && (
          <Link href="/dashboard/challenges/new" className="btn-primary shrink-0">
            <span className="sym sym-sm mr-1.5">add</span>
            New challenge
          </Link>
        )}
      </div>

      {!isAdmin && (
        <div className="alert-info mt-4">
          You have read-only access. Contact an admin to create or edit challenges.
        </div>
      )}

      {error && <div className="alert-error mt-4">{error}</div>}

      <div className="table-shell mt-6">
        {loading ? (
          <p className="p-6 text-sm font-medium text-ink-light">Loading challenges…</p>
        ) : challenges.length === 0 ? (
          <div className="p-10 text-center">
            <span className="sym sym-lg text-teal">emoji_events</span>
            <p className="mt-2 font-medium text-ink-light">No challenges yet.</p>
            {isAdmin && (
              <Link
                href="/dashboard/challenges/new"
                className="mt-3 inline-block font-display text-sm font-extrabold text-teal hover:underline"
              >
                Create your first challenge
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 font-display font-extrabold">Challenge</th>
                <th className="px-4 py-3 font-display font-extrabold">Habit</th>
                <th className="px-4 py-3 font-display font-extrabold">Status</th>
                <th className="px-4 py-3 font-display font-extrabold">Enrolled</th>
                <th className="px-4 py-3 font-display font-extrabold">Completed</th>
                <th className="px-4 py-3 font-display font-extrabold">Schedule</th>
                <th className="px-4 py-3 font-display font-extrabold" />
              </tr>
            </thead>
            <tbody>
              {challenges.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-display font-extrabold text-ink">{c.title}</td>
                  <td className="px-4 py-3 font-medium text-ink-light">{habitLabel(c.habit_type)}</td>
                  <td className="px-4 py-3">
                    <ChallengeStatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums font-medium text-ink">{c.enrolled_count}</td>
                  <td className="px-4 py-3 tabular-nums font-medium text-ink">
                    {c.completion_count}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink-light">
                    <span className="block">{formatDate(c.starts_at)}</span>
                    {c.ends_at && (
                      <span className="block text-xs">→ {formatDate(c.ends_at)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/dashboard/challenges/${c.id}`}
                        className="font-display font-extrabold text-teal hover:underline"
                      >
                        Metrics
                      </Link>
                      <Link
                        href={`/dashboard/challenges/${c.id}/edit`}
                        className="font-display font-extrabold text-ink-light hover:text-teal hover:underline"
                      >
                        {isAdmin ? "Manage" : "View"}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
