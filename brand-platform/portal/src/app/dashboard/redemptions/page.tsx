"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DateRangeFilter } from "@/components/date-range-filter";
import { PageHeader } from "@/components/page-header";

type Row = {
  id: string;
  redeemed_at: string;
  challenge_title: string;
  staff_email: string;
  user_label: string | null;
};

function RedemptionsLogInner() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/brands/redemptions${query ? `?${query}` : ""}`)
      .then((r) => r.json())
      .then((json) => {
        setRows(json.redemptions || []);
        setTotal(json.total ?? 0);
        setLabel(json.label || "");
      })
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="font-display text-sm font-extrabold text-teal hover:underline"
          >
            ← Dashboard
          </Link>
          <div className="mt-2">
            <PageHeader
              eyebrow="Activity"
              title="Redemptions"
              description={`${total} redemption${total === 1 ? "" : "s"}${label ? ` · ${label}` : ""}`}
            />
          </div>
        </div>
        <DateRangeFilter basePath="/dashboard/redemptions" />
      </div>

      <p className="mt-4 text-xs font-medium text-ink-light">
        Privacy: user column shows anonymized labels only. No names or contact info.
      </p>

      <div className="table-shell mt-6">
        {loading ? (
          <p className="p-6 text-sm text-ink-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-muted">No redemptions in this period.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 font-display font-extrabold">Redeemed at</th>
                <th className="px-4 py-3 font-display font-extrabold">Challenge</th>
                <th className="px-4 py-3 font-display font-extrabold">Staff</th>
                <th className="px-4 py-3 font-display font-extrabold">User</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-ink">
                    {new Date(row.redeemed_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-ink">{row.challenge_title}</td>
                  <td className="px-4 py-3 text-ink-muted">{row.staff_email}</td>
                  <td className="px-4 py-3 text-ink-muted">{row.user_label ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function RedemptionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
      <RedemptionsLogInner />
    </Suspense>
  );
}
