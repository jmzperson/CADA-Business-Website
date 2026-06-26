"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PRESETS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "custom", label: "Custom" },
] as const;

export function DateRangeFilter({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("range") || "30d";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  function apply(params: Record<string, string>) {
    const q = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v) q.set(k, v);
      else q.delete(k);
    });
    router.push(`${basePath}?${q.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label mb-1" htmlFor="range-preset">
          Date range
        </label>
        <select
          id="range-preset"
          className="input min-w-[140px]"
          value={current}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "custom") {
              apply({ range: "custom" });
            } else {
              apply({ range: v, from: "", to: "" });
            }
          }}
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {current === "custom" && (
        <>
          <div>
            <label className="label mb-1" htmlFor="from">
              From
            </label>
            <input
              id="from"
              type="date"
              className="input"
              value={from}
              onChange={(e) => apply({ range: "custom", from: e.target.value, to })}
            />
          </div>
          <div>
            <label className="label mb-1" htmlFor="to">
              To
            </label>
            <input
              id="to"
              type="date"
              className="input"
              value={to}
              onChange={(e) => apply({ range: "custom", from, to: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}
