"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { DateRangeFilter } from "@/components/date-range-filter";
import { FunnelChart, KpiCard } from "@/components/metrics-ui";
import { PageHeader } from "@/components/page-header";

function ChallengeMetricsInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const query = searchParams.toString();

  const [data, setData] = useState<{
    challenge: { title: string; status: string };
    label: string;
    enrolled: number;
    active_this_week: number;
    completions: number;
    qr_issued: number;
    qr_redeemed: number;
    redemption_rate: number | null;
    funnel: { enrolled: number; completed: number; qr_issued: number; qr_redeemed: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/brands/metrics/challenges/${id}${query ? `?${query}` : ""}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id, query]);

  const rate =
    data?.redemption_rate != null ? `${Math.round(data.redemption_rate * 100)}%` : "—";

  if (loading) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (!data?.challenge) return <p className="text-sm text-red-600">Challenge not found</p>;

  return (
    <div>
      <Link
        href="/dashboard/challenges"
        className="font-display text-sm font-extrabold text-teal hover:underline"
      >
        ← All challenges
      </Link>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Metrics"
          title={data.challenge.title}
          description={`${data.challenge.status} · ${data.label}`}
        />
        <DateRangeFilter basePath={`/dashboard/challenges/${id}`} />
      </div>

      <div className="mt-4 flex gap-3 text-sm">
        <Link
          href={`/dashboard/challenges/${id}/edit`}
          className="font-medium text-teal hover:underline"
        >
          Manage challenge
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Enrolled" value={data.enrolled} />
        <KpiCard label="Active this week" value={data.active_this_week} />
        <KpiCard label="Completions" value={data.completions} />
        <KpiCard label="QR issued" value={data.qr_issued} />
        <KpiCard label="QR redeemed" value={data.qr_redeemed} />
        <KpiCard label="Redemption rate" value={rate} />
      </div>

      <div className="mt-6">
        <FunnelChart funnel={data.funnel} />
      </div>
    </div>
  );
}

export default function ChallengeMetricsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
      <ChallengeMetricsInner />
    </Suspense>
  );
}
