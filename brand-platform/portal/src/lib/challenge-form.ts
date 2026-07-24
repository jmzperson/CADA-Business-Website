import {
  CHALLENGE_DURATIONS,
  CUSTOM_HABIT_VALUE,
  HABIT_TYPES,
  JOIN_WINDOW_OPTIONS,
  isChallengeDurationDays,
  isKnownHabitType,
  type ChallengeDurationDays,
  type JoinWindowDays,
} from "@/lib/challenge-constants";

export type ChallengeFormValues = {
  title: string;
  description: string;
  /** Select value: a known habit slug, or `custom` when typing a free-text habit. */
  habit_type: string;
  /** Free-text label used when habit_type is `custom`. */
  habit_custom_label: string;
  offer_headline: string;
  offer_code: string;
  starts_at: string;
  /** Campaign length: 1, 7, or 30 days from start. */
  duration_days: ChallengeDurationDays;
  /** How long after start users may join: 1, 3, 5, 7, or 30 days. */
  join_window_days: JoinWindowDays;
  /** Derived from starts_at + duration_days; sent to the API as ends_at. */
  ends_at: string;
  max_redemptions: string;
};

export function toDatetimeLocal(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function endsAtFromDuration(startsAt: string, days: ChallengeDurationDays): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "";
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + days);
  return toDatetimeLocal(end);
}

/** Infer the closest 1 / 7 / 30 day option from stored start/end timestamps. */
export function durationFromStored(
  startsAt: string,
  endsAt: string | null
): ChallengeDurationDays {
  if (!endsAt) return 7;
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 7;

  const days = Math.round((end - start) / (24 * 60 * 60 * 1000));
  let best: ChallengeDurationDays = 7;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const option of CHALLENGE_DURATIONS) {
    const diff = Math.abs(option.value - days);
    if (diff < bestDiff) {
      best = option.value;
      bestDiff = diff;
    }
  }
  return best;
}

export function joinWindowFromStored(stored: number | null | undefined): JoinWindowDays {
  if (stored != null && JOIN_WINDOW_OPTIONS.some((d) => d.value === stored)) {
    return stored as JoinWindowDays;
  }
  return 7;
}

export const emptyChallengeForm = (): ChallengeFormValues => {
  const startsAt = toDatetimeLocal(new Date());
  const durationDays: ChallengeDurationDays = 7;
  return {
    title: "",
    description: "",
    habit_type: "gym",
    habit_custom_label: "",
    offer_headline: "",
    offer_code: "",
    starts_at: startsAt,
    duration_days: durationDays,
    join_window_days: 7,
    ends_at: endsAtFromDuration(startsAt, durationDays),
    max_redemptions: "",
  };
};

export function habitLabel(value: string) {
  return HABIT_TYPES.find((h) => h.value === value)?.label ?? value;
}

export function durationLabel(days: number) {
  return CHALLENGE_DURATIONS.find((d) => d.value === days)?.label ?? `${days} days`;
}

export function joinWindowLabel(days: number) {
  return JOIN_WINDOW_OPTIONS.find((d) => d.value === days)?.label ?? `${days} days`;
}

/** Map a stored habit_type onto the form select + optional custom text field. */
export function habitFieldsFromStored(stored: string): Pick<
  ChallengeFormValues,
  "habit_type" | "habit_custom_label"
> {
  if (isKnownHabitType(stored)) {
    return { habit_type: stored, habit_custom_label: "" };
  }
  if (!stored || stored === CUSTOM_HABIT_VALUE) {
    return { habit_type: CUSTOM_HABIT_VALUE, habit_custom_label: "" };
  }
  return { habit_type: CUSTOM_HABIT_VALUE, habit_custom_label: stored };
}

/** Resolve form habit fields to the value persisted on the challenge. */
export function resolveStoredHabitType(values: ChallengeFormValues): string {
  if (values.habit_type === CUSTOM_HABIT_VALUE) {
    return values.habit_custom_label.trim();
  }
  return values.habit_type;
}

export function withSyncedDuration(
  values: ChallengeFormValues,
  patch: Partial<Pick<ChallengeFormValues, "starts_at" | "duration_days">>
): ChallengeFormValues {
  const next = { ...values, ...patch };
  const days = isChallengeDurationDays(Number(next.duration_days))
    ? (Number(next.duration_days) as ChallengeDurationDays)
    : 7;
  next.duration_days = days;
  next.ends_at = endsAtFromDuration(next.starts_at, days);
  return next;
}
