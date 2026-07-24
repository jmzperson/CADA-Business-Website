/** Challenge campaign length options (sets ends_at from starts_at). */
export const CHALLENGE_DURATIONS = [
  { value: 1, label: "1 day" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
] as const;

export type ChallengeDurationDays = (typeof CHALLENGE_DURATIONS)[number]["value"];

export function isChallengeDurationDays(value: number): value is ChallengeDurationDays {
  return CHALLENGE_DURATIONS.some((d) => d.value === value);
}

/** How long after start users may enroll in the challenge. */
export const JOIN_WINDOW_OPTIONS = [
  { value: 1, label: "1 day" },
  { value: 3, label: "3 days" },
  { value: 5, label: "5 days" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
] as const;

export type JoinWindowDays = (typeof JOIN_WINDOW_OPTIONS)[number]["value"];

export function isJoinWindowDays(value: number): value is JoinWindowDays {
  return JOIN_WINDOW_OPTIONS.some((d) => d.value === value);
}

/** Client-safe challenge types and helpers (no DB / firebase-admin deps). */

export type HabitOption = {
  value: string;
  label: string;
  appLabel: string;
};

export type HabitCategory = {
  id: string;
  label: string;
  habits: readonly HabitOption[];
};

/** Grouped habit options shown in the partner challenge form. */
export const HABIT_CATEGORIES: readonly HabitCategory[] = [
  {
    id: "body",
    label: "Body",
    habits: [
      { value: "exercise", label: "Exercise", appLabel: "Exercise" },
      { value: "run", label: "Run", appLabel: "Run" },
      { value: "gym", label: "Gym", appLabel: "Knocked Out · Gym" },
      { value: "walk", label: "Walk", appLabel: "Walk" },
      { value: "stretch", label: "Stretch", appLabel: "Stretch" },
      { value: "sleep_8hrs", label: "Sleep 8hrs", appLabel: "Sleep 8hrs" },
      { value: "nap", label: "Nap", appLabel: "Nap" },
    ],
  },
  {
    id: "connection",
    label: "Connection",
    habits: [
      { value: "call_family", label: "Call Family", appLabel: "Call Family" },
      { value: "text_friend", label: "Text a Friend", appLabel: "Crushed · Text a Friend" },
      { value: "quality_time", label: "Quality Time", appLabel: "Quality Time" },
      { value: "do_something_kind", label: "Do Something Kind", appLabel: "Do Something Kind" },
    ],
  },
  {
    id: "presence",
    label: "Presence",
    habits: [
      { value: "meditate", label: "Meditate", appLabel: "Meditate" },
      { value: "no_phone_morning", label: "No Phone Morning", appLabel: "No Phone Morning" },
      { value: "hike", label: "Hike", appLabel: "Hike" },
      { value: "gratitude", label: "Gratitude", appLabel: "Gratitude" },
      { value: "one_hard_thing", label: "One Hard Thing", appLabel: "One Hard Thing" },
    ],
  },
  {
    id: "mind_growth",
    label: "Mind & Growth",
    habits: [
      { value: "read", label: "Read", appLabel: "Read" },
      { value: "journal", label: "Journal", appLabel: "Journal" },
      { value: "write", label: "Write", appLabel: "Write" },
      { value: "draw", label: "Draw", appLabel: "Draw" },
      { value: "create_something", label: "Create Something", appLabel: "Create Something" },
      { value: "study", label: "Study", appLabel: "Study" },
      { value: "practice_guitar", label: "Practice Guitar", appLabel: "Practice Guitar" },
      { value: "practice_language", label: "Practice Language", appLabel: "Practice Language" },
    ],
  },
] as const;

/** Flat list of predefined habits (excludes the Custom UI sentinel). */
export const HABIT_TYPES: readonly HabitOption[] = HABIT_CATEGORIES.flatMap((c) => [...c.habits]);

/** Select value that unlocks the free-text custom habit field. Not stored on challenges. */
export const CUSTOM_HABIT_VALUE = "custom";

const KNOWN_HABIT_VALUES = new Set(HABIT_TYPES.map((h) => h.value));

export type HabitType = string;
export type ChallengeStatus = "draft" | "pending_review" | "rejected" | "active" | "ended";

export type ChallengeRow = {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  habit_type: HabitType;
  offer_headline: string;
  offer_code: string | null;
  status: ChallengeStatus;
  starts_at: string;
  ends_at: string | null;
  /** Days after starts_at that new users may enroll. Null = legacy (open until ends_at). */
  join_window_days: number | null;
  completion_rule: string;
  max_redemptions: number | null;
  published_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ChallengeInput = {
  title?: string;
  description?: string;
  habit_type?: string;
  offer_headline?: string;
  offer_code?: string | null;
  starts_at?: string;
  ends_at?: string | null;
  join_window_days?: number | null;
  max_redemptions?: number | null;
};

export type ChallengeMetrics = {
  enrolled_count: number;
  completion_count: number;
  redemption_count: number;
};

export type RedemptionUsage = {
  redemption_count: number;
  pending_issued_count: number;
};

export function serializeChallenge(row: ChallengeRow, metrics?: ChallengeMetrics) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    habit_type: row.habit_type,
    offer_headline: row.offer_headline,
    offer_code: row.offer_code,
    status: row.status,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    join_window_days: row.join_window_days ?? null,
    max_redemptions: row.max_redemptions,
    published_at: row.published_at,
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at,
    reviewed_by: row.reviewed_by,
    rejection_reason: row.rejection_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
    enrolled_count: metrics?.enrolled_count ?? 0,
    completion_count: metrics?.completion_count ?? 0,
    redemption_count: metrics?.redemption_count ?? 0,
  };
}

export function isKnownHabitType(value: string): boolean {
  return KNOWN_HABIT_VALUES.has(value);
}

/**
 * Accepts predefined habit slugs, free-text custom labels, or legacy `custom`.
 * The form UI uses `custom` only as a sentinel and stores the typed label instead.
 */
export function validateHabitType(value: string): value is HabitType {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed === CUSTOM_HABIT_VALUE) return true;
  if (isKnownHabitType(trimmed)) return true;
  return trimmed.length <= 80;
}

export function parseChallengeInput(body: ChallengeInput, partial = false) {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) errors.push("title is required");
    else data.title = title;
  } else if (!partial) {
    errors.push("title is required");
  }

  if (body.description !== undefined) {
    data.description = body.description.trim();
  } else if (!partial) {
    data.description = "";
  }

  if (body.habit_type !== undefined) {
    const habit = body.habit_type.trim();
    if (!validateHabitType(habit)) errors.push("invalid habit_type");
    else data.habit_type = habit;
  } else if (!partial) {
    errors.push("habit_type is required");
  }

  if (body.offer_headline !== undefined) {
    const headline = body.offer_headline.trim();
    if (!headline) errors.push("offer_headline is required");
    else data.offer_headline = headline;
  } else if (!partial) {
    errors.push("offer_headline is required");
  }

  if (body.offer_code !== undefined) {
    data.offer_code = body.offer_code?.trim() || null;
  }

  if (body.starts_at !== undefined) {
    const starts = new Date(body.starts_at);
    if (Number.isNaN(starts.getTime())) errors.push("starts_at must be a valid date");
    else data.starts_at = starts.toISOString();
  } else if (!partial) {
    errors.push("starts_at is required");
  }

  if (body.ends_at !== undefined) {
    if (body.ends_at === null || body.ends_at === "") {
      data.ends_at = null;
    } else {
      const ends = new Date(body.ends_at);
      if (Number.isNaN(ends.getTime())) errors.push("ends_at must be a valid date");
      else data.ends_at = ends.toISOString();
    }
  }

  if (body.join_window_days !== undefined) {
    if (body.join_window_days === null) {
      data.join_window_days = null;
    } else {
      const days = Number(body.join_window_days);
      if (!isJoinWindowDays(days)) {
        errors.push("join_window_days must be 1, 3, 5, 7, or 30");
      } else {
        data.join_window_days = days;
      }
    }
  } else if (!partial) {
    errors.push("join_window_days is required");
  }

  if (body.max_redemptions !== undefined) {
    if (body.max_redemptions === null || body.max_redemptions === ("" as unknown)) {
      data.max_redemptions = null;
    } else {
      const cap = Number(body.max_redemptions);
      if (!Number.isInteger(cap) || cap < 1) {
        errors.push("max_redemptions must be a positive integer");
      } else {
        data.max_redemptions = cap;
      }
    }
  }

  if (data.starts_at && data.ends_at) {
    if (new Date(data.ends_at as string) <= new Date(data.starts_at as string)) {
      errors.push("ends_at must be after starts_at");
    }
  }

  return { data, errors };
}

export function validatePublishFields(row: ChallengeRow) {
  const errors: string[] = [];
  if (!row.title?.trim()) errors.push("title is required");
  if (!row.habit_type) errors.push("habit_type is required");
  if (!row.offer_headline?.trim()) errors.push("offer_headline is required");
  if (!row.starts_at) errors.push("starts_at is required");
  if (row.join_window_days != null && !isJoinWindowDays(row.join_window_days)) {
    errors.push("join_window_days must be 1, 3, 5, 7, or 30");
  }
  if (row.ends_at && new Date(row.ends_at) <= new Date(row.starts_at)) {
    errors.push("ends_at must be after starts_at");
  }
  return errors;
}

export function joinWindowClosesAt(
  startsAt: string,
  joinWindowDays: number,
  endsAt?: string | null
): Date {
  const close = new Date(startsAt);
  close.setDate(close.getDate() + joinWindowDays);
  if (endsAt) {
    const ends = new Date(endsAt);
    if (!Number.isNaN(ends.getTime()) && ends < close) return ends;
  }
  return close;
}

/** True while the challenge is live for enrolled users (habit completion window). */
export function isChallengeInDiscoveryWindow(
  row: { starts_at: string; ends_at: string | null; status?: string },
  now = new Date()
): boolean {
  if (row.status && row.status !== "active") return false;
  if (new Date(row.starts_at) > now) return false;
  if (row.ends_at && new Date(row.ends_at) <= now) return false;
  return true;
}

/** True while new users may still enroll (respects time-to-join window). */
export function isChallengeJoinable(
  row: {
    starts_at: string;
    ends_at: string | null;
    join_window_days?: number | null;
    status?: string;
  },
  now = new Date()
): boolean {
  if (!isChallengeInDiscoveryWindow(row, now)) return false;
  if (row.join_window_days == null) return true;
  return now < joinWindowClosesAt(row.starts_at, row.join_window_days, row.ends_at);
}

export function isAtRedemptionCap(
  maxRedemptions: number | null,
  usage: RedemptionUsage
): boolean {
  if (maxRedemptions == null) return false;
  return usage.redemption_count + usage.pending_issued_count >= maxRedemptions;
}

export function spotsRemaining(
  maxRedemptions: number | null,
  usage: RedemptionUsage
): number | null {
  if (maxRedemptions == null) return null;
  return Math.max(0, maxRedemptions - usage.redemption_count - usage.pending_issued_count);
}
