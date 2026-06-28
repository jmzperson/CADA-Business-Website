import {
  batchGetByIds,
  getCadaUsersByIds,
  getChallengeForBrand,
  listChallengesByBrandAndStatus,
  listEnrollmentsByChallengeIds,
  listHabitEventsByEnrollmentIds,
  listRedemptionsPaginated,
  countQrRewardsIssued,
  countRedemptionsInRange,
} from "@/lib/db";
import type { RedemptionDoc } from "@/lib/db/types";
import { COLLECTIONS } from "@/lib/db/types";
import { activeWeekStart } from "@/lib/metrics/range";

export type FunnelMetrics = {
  enrolled: number;
  completed: number;
  qr_issued: number;
  qr_redeemed: number;
};

export type BrandMetricsResult = {
  enrolled: number;
  active_this_week: number;
  completions: number;
  qr_issued: number;
  qr_redeemed: number;
  redemption_rate: number | null;
  funnel: FunnelMetrics;
};

export type RedemptionLogRow = {
  id: string;
  redeemed_at: string;
  challenge_id: string;
  challenge_title: string;
  staff_email: string;
  user_label: string | null;
};

const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_TTL_MS = 60_000;

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return null;
  return hit.data as T;
}

function cacheSet(key: string, data: unknown) {
  cache.set(key, { at: Date.now(), data });
}

export function redemptionRate(redeemed: number, issued: number): number | null {
  if (issued === 0) return null;
  return Math.round((redeemed / issued) * 1000) / 1000;
}

export async function getBrandMetrics(
  brandId: string,
  from: string,
  to: string,
  challengeId?: string
): Promise<BrandMetricsResult> {
  const cacheKey = `brand:${brandId}:${challengeId ?? "all"}:${from}:${to}`;
  const cached = cacheGet<BrandMetricsResult>(cacheKey);
  if (cached) return cached;

  const challengeIds = await getChallengeIds(brandId, challengeId);

  if (challengeIds.length === 0) {
    const empty: BrandMetricsResult = {
      enrolled: 0,
      active_this_week: 0,
      completions: 0,
      qr_issued: 0,
      qr_redeemed: 0,
      redemption_rate: null,
      funnel: { enrolled: 0, completed: 0, qr_issued: 0, qr_redeemed: 0 },
    };
    cacheSet(cacheKey, empty);
    return empty;
  }

  const enrollments = await listEnrollmentsByChallengeIds(challengeIds);
  const enrolled = enrollments.filter(
    (e) => e.enrolled_at >= from && e.enrolled_at <= to
  ).length;

  const completed = enrollments.filter(
    (e) =>
      e.status === "completed" &&
      e.completed_at &&
      e.completed_at >= from &&
      e.completed_at <= to
  ).length;

  const allEnrollmentIds = enrollments.map((e) => e.id);

  let completions = 0;
  if (allEnrollmentIds.length > 0) {
    const events = await listHabitEventsByEnrollmentIds(allEnrollmentIds);
    completions = events.filter(
      (ev) =>
        ev.enrollment_id &&
        ev.completed_at >= from &&
        ev.completed_at <= to
    ).length;
  }

  const weekStart = activeWeekStart();
  let activeThisWeek = 0;
  if (allEnrollmentIds.length > 0) {
    const weekEvents = (await listHabitEventsByEnrollmentIds(allEnrollmentIds)).filter(
      (ev) => ev.completed_at >= weekStart
    );
    activeThisWeek = new Set(weekEvents.map((e) => e.user_id)).size;
  }

  const issued = await countQrRewardsIssued(brandId, from, to, challengeId);
  const redeemed = await countRedemptionsInRange(brandId, from, to, challengeId);

  const result: BrandMetricsResult = {
    enrolled,
    active_this_week: activeThisWeek,
    completions,
    qr_issued: issued,
    qr_redeemed: redeemed,
    redemption_rate: redemptionRate(redeemed, issued),
    funnel: {
      enrolled,
      completed,
      qr_issued: issued,
      qr_redeemed: redeemed,
    },
  };

  cacheSet(cacheKey, result);
  return result;
}

export async function getRedemptionsLog(
  brandId: string,
  from: string | null,
  to: string | null,
  page = 1,
  pageSize = 25,
  challengeId?: string
): Promise<{ rows: RedemptionLogRow[]; total: number }> {
  const { rows: redemptions, total } = await listRedemptionsPaginated(
    brandId,
    from,
    to,
    challengeId,
    page,
    pageSize
  );

  if (!redemptions.length) {
    return { rows: [], total };
  }

  return {
    rows: await enrichRedemptionRows(redemptions),
    total,
  };
}

async function enrichRedemptionRows(redemptions: RedemptionDoc[]): Promise<RedemptionLogRow[]> {
  const qrIds = redemptions.map((r) => r.qr_reward_id);
  const staffIds = [...new Set(redemptions.map((r) => r.staff_id))];

  const [qrRewards, staff] = await Promise.all([
    batchGetByIds<{ id: string; challenge_id: string; enrollment_id: string }>(
      COLLECTIONS.qrRewards,
      qrIds
    ),
    batchGetByIds<{ id: string; email: string }>(COLLECTIONS.brandStaff, staffIds),
  ]);

  const challengeIds = [
    ...new Set(
      qrRewards
        .map((q) => q.challenge_id)
        .concat(redemptions.map((r) => r.challenge_id))
        .filter(Boolean)
    ),
  ];
  const enrollmentIds = [...new Set(qrRewards.map((q) => q.enrollment_id))];

  const [challenges, enrollments] = await Promise.all([
    batchGetByIds<{ id: string; title: string }>(COLLECTIONS.challenges, challengeIds),
    batchGetByIds<{ id: string; user_id: string }>(COLLECTIONS.enrollments, enrollmentIds),
  ]);

  const userIds = [...new Set(enrollments.map((e) => e.user_id))];
  const users = userIds.length
    ? await getCadaUsersByIds(userIds)
    : [];

  const staffById = new Map(staff.map((s) => [s.id, s.email]));
  const qrById = new Map(qrRewards.map((q) => [q.id, q]));
  const challengeById = new Map(challenges.map((c) => [c.id, c.title]));
  const enrollmentById = new Map(enrollments.map((e) => [e.id, e.user_id]));
  const userById = new Map(users.map((u) => [u.id, u.display_label]));

  return redemptions.map((row) => {
    const qr = qrById.get(row.qr_reward_id);
    const resolvedChallengeId = row.challenge_id || qr?.challenge_id || "";
    const userId = qr ? enrollmentById.get(qr.enrollment_id) : undefined;

    return {
      id: row.id,
      redeemed_at: row.redeemed_at,
      challenge_id: resolvedChallengeId,
      challenge_title: resolvedChallengeId
        ? challengeById.get(resolvedChallengeId) ?? "Challenge"
        : "Challenge",
      staff_email: staffById.get(row.staff_id) ?? "—",
      user_label: userId ? userById.get(userId) ?? null : null,
    };
  });
}

async function getChallengeIds(brandId: string, challengeId?: string): Promise<string[]> {
  if (challengeId) {
    const row = await getChallengeForBrand(challengeId, brandId);
    if (!row || (row.status !== "active" && row.status !== "ended")) return [];
    return [row.id];
  }

  const rows = await listChallengesByBrandAndStatus(brandId, ["active", "ended"]);
  return rows.map((c) => c.id);
}

/** Call after redeem to bust cached aggregates for a brand. */
export function invalidateMetricsCache(brandId: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(`brand:${brandId}:`)) {
      cache.delete(key);
    }
  }
}
