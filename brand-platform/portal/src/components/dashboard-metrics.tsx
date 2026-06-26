"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DateRangeFilter } from "@/components/date-range-filter";
import { FunnelChart, KpiCard } from "@/components/metrics-ui";
import { EmptyMetricsState, OnboardingChecklist } from "@/components/onboarding-checklist";
import { PageHeader } from "@/components/page-header";
import type { OnboardingState } from "@/lib/onboarding";

type MetricsResponse = {
  label: string;
  enrolled: number;
  active_this_week: number;
  completions: number;
  qr_issued: number;
  qr_redeemed: number;
  redemption_rate: number | null;
  funnel: {
    enrolled: number;
    completed: number;
    qr_issued: number;
    qr_redeemed: number;
  };
};

function DashboardMetricsInner({ brandName }: { brandName: string }) {
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = searchParams.toString();

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetch(`/api/brands/metrics${query ? `?${query}` : ""}`).then((r) => r.json()),
      fetch("/api/brands/onboarding").then((r) => r.json()),
    ])
      .then(([metricsJson, onboardingJson]) => {
        if (metricsJson.error) setError(metricsJson.error);
        else setData(metricsJson);
        setOnboarding(onboardingJson);
      })
      .catch(() => setError("Failed to load metrics"))
      .finally(() => setLoading(false));
  }, [query]);

  const rate =
    data?.redemption_rate != null ? `${Math.round(data.redemption_rate * 100)}%` : "—";

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Overview"
          title="Dashboard"
          description={`Partnership metrics for ${brandName}${data?.label ? ` · ${data.label}` : ""}`}
        />
        <DateRangeFilter basePath="/dashboard" />
      </div>

      {error && <div className="alert-error mt-4">{error}</div>}

      <div className="mt-6">
        <OnboardingChecklist welcome={welcome} />
      </div>

      {loading && <p className="mt-8 text-sm font-medium text-ink-light">Loading metrics…</p>}

      {!onboarding?.has_published_challenge && !loading && (
        <EmptyMetricsState
          hasChallenges={onboarding?.has_challenges ?? false}
          hasPublished={onboarding?.has_published_challenge}
        />
      )}

      {data && !loading && onboarding?.has_published_challenge && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard label="Total enrolled" value={data.enrolled} />
            <KpiCard
              label="Active this week"
              value={data.active_this_week}
              hint="Completed linked habit in last 7 days"
            />
            <KpiCard label="Completions" value={data.completions} />
            <KpiCard label="QR issued" value={data.qr_issued} />
            <KpiCard label="QR redeemed" value={data.qr_redeemed} />
            <KpiCard label="Redemption rate" value={rate} hint="Redeemed ÷ issued" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <FunnelChart funnel={data.funnel} />
            <div className="card">
              <h2 className="font-display text-lg font-extrabold text-ink">Quick links</h2>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link
                    href="/dashboard/redemptions"
                    className="font-display font-extrabold text-teal hover:underline"
                  >
                    View redemptions log
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/challenges"
                    className="font-display font-extrabold text-teal hover:underline"
                  >
                    Challenge metrics
                  </Link>
                </li>
                <li>
                  <Link href="/scan" className="font-display font-extrabold text-teal hover:underline">
                    Scan QR rewards
                  </Link>
                </li>
              </ul>
              <p className="mt-4 text-xs font-medium text-ink-light">
                Counts are anonymized. User labels show opaque IDs only (e.g. User #A1).
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardMetrics({ brandName }: { brandName: string }) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
      <DashboardMetricsInner brandName={brandName} />
    </Suspense>
  );
}
