import {
  countRedemptionsByChallenge,
  expireEndedChallenges as expireEndedChallengesDb,
  getChallengeById,
  getChallengeForBrand as getChallengeForBrandDb,
  listEnrollmentsByChallengeIds,
  listIssuedQrRewardsByChallenge,
  listRedemptionsByChallengeIds,
} from "@/lib/db";

export const HABIT_TYPES = [
  { value: "gym", label: "Gym", appLabel: "Knocked Out · Gym" },
  { value: "text_friend", label: "Text a Friend", appLabel: "Crushed · Text a Friend" },
  { value: "call_family", label: "Call Family", appLabel: "Call Family" },
  { value: "run", label: "Run", appLabel: "Run" },
  { value: "stretch", label: "Stretch", appLabel: "Stretch" },
  { value: "journal", label: "Journal", appLabel: "Journal" },
  { value: "custom", label: "Custom", appLabel: "Custom habit" },
] as const;

export type HabitType = (typeof HABIT_TYPES)[number]["value"];
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
  max_redemptions?: number | null;
};

export type ChallengeMetrics = {
  enrolled_count: number;
  completion_count: number;
  redemption_count: number;
};

const emptyMetrics = (): ChallengeMetrics => ({
  enrolled_count: 0,
  completion_count: 0,
  redemption_count: 0,
});

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

export function validateHabitType(value: string): value is HabitType {
  return HABIT_TYPES.some((h) => h.value === value);
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
    if (!validateHabitType(body.habit_type)) errors.push("invalid habit_type");
    else data.habit_type = body.habit_type;
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
  if (row.ends_at && new Date(row.ends_at) <= new Date(row.starts_at)) {
    errors.push("ends_at must be after starts_at");
  }
  return errors;
}

export async function getChallengeMetrics(
  challengeIds: string[]
): Promise<Record<string, ChallengeMetrics>> {
  const result: Record<string, ChallengeMetrics> = {};
  for (const id of challengeIds) {
    result[id] = emptyMetrics();
  }
  if (challengeIds.length === 0) return result;

  const enrollments = await listEnrollmentsByChallengeIds(challengeIds);

  for (const row of enrollments) {
    const m = result[row.challenge_id];
    if (!m) continue;
    m.enrolled_count += 1;
    if (row.status === "completed") m.completion_count += 1;
  }

  const reds = await listRedemptionsByChallengeIds(challengeIds);

  for (const r of reds) {
    const m = result[r.challenge_id];
    if (m) m.redemption_count += 1;
  }

  return result;
}

export async function challengeHasRedemptions(challengeId: string): Promise<boolean> {
  return (await countRedemptionsByChallenge(challengeId)) > 0;
}

export async function getChallengeForBrand(challengeId: string, brandId: string) {
  const row = await getChallengeForBrandDb(challengeId, brandId);
  return row as ChallengeRow | null;
}

export type RedemptionUsage = {
  redemption_count: number;
  pending_issued_count: number;
};

export function isChallengeInDiscoveryWindow(
  row: { starts_at: string; ends_at: string | null; status?: string },
  now = new Date()
): boolean {
  if (row.status && row.status !== "active") return false;
  if (new Date(row.starts_at) > now) return false;
  if (row.ends_at && new Date(row.ends_at) <= now) return false;
  return true;
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

export async function getRedemptionUsageByChallenge(
  challengeIds: string[]
): Promise<Record<string, RedemptionUsage>> {
  const result: Record<string, RedemptionUsage> = {};
  for (const id of challengeIds) {
    result[id] = { redemption_count: 0, pending_issued_count: 0 };
  }
  if (challengeIds.length === 0) return result;

  const metrics = await getChallengeMetrics(challengeIds);
  for (const id of challengeIds) {
    result[id].redemption_count = metrics[id]?.redemption_count ?? 0;
  }

  for (const id of challengeIds) {
    const pending = await listIssuedQrRewardsByChallenge(id);
    result[id].pending_issued_count = pending.length;
  }

  return result;
}

export async function challengeCanIssueReward(challengeId: string): Promise<boolean> {
  const challenge = await getChallengeById(challengeId);

  if (!challenge) return false;

  const usage = await getRedemptionUsageByChallenge([challengeId]);
  return !isAtRedemptionCap(challenge.max_redemptions, usage[challengeId]);
}

/** Mark active challenges past ends_at as ended. Safe to run repeatedly. */
export async function expireEndedChallenges(): Promise<number> {
  return expireEndedChallengesDb();
}
