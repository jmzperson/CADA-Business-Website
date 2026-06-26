export type MetricsRangePreset = "7d" | "30d" | "90d" | "custom";

export type MetricsRange = {
  preset: MetricsRangePreset;
  from: string;
  to: string;
  label: string;
};

export function parseMetricsRange(searchParams: URLSearchParams): MetricsRange {
  const range = searchParams.get("range") || "30d";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const now = new Date();

  if (range === "custom" && fromParam && toParam) {
    const from = startOfDay(new Date(fromParam));
    const to = endOfDay(new Date(toParam));
    return {
      preset: "custom",
      from: from.toISOString(),
      to: to.toISOString(),
      label: `${formatShort(from)} – ${formatShort(to)}`,
    };
  }

  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const from = startOfDay(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
  const to = endOfDay(now);

  return {
    preset: range === "7d" || range === "90d" ? range : "30d",
    from: from.toISOString(),
    to: to.toISOString(),
    label: `Last ${days} days`,
  };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

function formatShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function activeWeekStart(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString();
}
