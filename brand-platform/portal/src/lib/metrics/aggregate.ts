import { createAdminClient } from "@/lib/supabase/admin";
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

  const admin = createAdminClient();
  const challengeIds = await getChallengeIds(admin, brandId, challengeId);

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

  const { data: enrollments } = await admin
    .from("user_challenge_enrollments")
    .select("id, enrolled_at")
    .in("challenge_id", challengeIds)
    .gte("enrolled_at", from)
    .lte("enrolled_at", to);

  const enrolled = enrollments?.length ?? 0;

  const { data: completedEnrollments } = await admin
    .from("user_challenge_enrollments")
    .select("id")
    .in("challenge_id", challengeIds)
    .eq("status", "completed")
    .gte("completed_at", from)
    .lte("completed_at", to);

  const completed = completedEnrollments?.length ?? 0;

  const { data: allEnrollments } = await admin
    .from("user_challenge_enrollments")
    .select("id, user_id")
    .in("challenge_id", challengeIds);

  const allEnrollmentIds = (allEnrollments ?? []).map((e) => e.id);

  let completions = 0;
  if (allEnrollmentIds.length > 0) {
    const { count } = await admin
      .from("habit_completion_events")
      .select("id", { count: "exact", head: true })
      .in("enrollment_id", allEnrollmentIds)
      .not("enrollment_id", "is", null)
      .gte("completed_at", from)
      .lte("completed_at", to);
    completions = count ?? 0;
  }

  const weekStart = activeWeekStart();
  let activeThisWeek = 0;
  if (allEnrollmentIds.length > 0) {
    const { data: weekEvents } = await admin
      .from("habit_completion_events")
      .select("user_id")
      .in("enrollment_id", allEnrollmentIds)
      .gte("completed_at", weekStart);

    activeThisWeek = new Set((weekEvents ?? []).map((e) => e.user_id)).size;
  }

  let qrIssuedQuery = admin
    .from("qr_rewards")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .in("status", ["issued", "redeemed"])
    .gte("issued_at", from)
    .lte("issued_at", to);

  if (challengeId) {
    qrIssuedQuery = qrIssuedQuery.eq("challenge_id", challengeId);
  }

  const { count: qrIssued } = await qrIssuedQuery;

  let qrRedeemedQuery = admin
    .from("redemptions")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .gte("redeemed_at", from)
    .lte("redeemed_at", to);

  if (challengeId) {
    const { data: qrForChallenge } = await admin
      .from("qr_rewards")
      .select("id")
      .eq("brand_id", brandId)
      .eq("challenge_id", challengeId);

    const qrIds = (qrForChallenge ?? []).map((q) => q.id);
    if (qrIds.length === 0) {
      const result: BrandMetricsResult = {
        enrolled,
        active_this_week: activeThisWeek,
        completions,
        qr_issued: 0,
        qr_redeemed: 0,
        redemption_rate: null,
        funnel: { enrolled, completed, qr_issued: 0, qr_redeemed: 0 },
      };
      cacheSet(cacheKey, result);
      return result;
    }

    qrRedeemedQuery = admin
      .from("redemptions")
      .select("id", { count: "exact", head: true })
      .in("qr_reward_id", qrIds)
      .gte("redeemed_at", from)
      .lte("redeemed_at", to);
  }

  const { count: qrRedeemed } = await qrRedeemedQuery;

  const issued = qrIssued ?? 0;
  const redeemed = qrRedeemed ?? 0;

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
  from: string,
  to: string,
  page = 1,
  pageSize = 25
): Promise<{ rows: RedemptionLogRow[]; total: number }> {
  const admin = createAdminClient();
  const offset = (page - 1) * pageSize;

  const { count } = await admin
    .from("redemptions")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .gte("redeemed_at", from)
    .lte("redeemed_at", to);

  const { data: redemptions } = await admin
    .from("redemptions")
    .select("id, redeemed_at, qr_reward_id, staff_id")
    .eq("brand_id", brandId)
    .gte("redeemed_at", from)
    .lte("redeemed_at", to)
    .order("redeemed_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (!redemptions?.length) {
    return { rows: [], total: count ?? 0 };
  }

  const qrIds = redemptions.map((r) => r.qr_reward_id);
  const staffIds = [...new Set(redemptions.map((r) => r.staff_id))];

  const [{ data: qrRewards }, { data: staff }] = await Promise.all([
    admin
      .from("qr_rewards")
      .select("id, challenge_id, enrollment_id")
      .in("id", qrIds),
    admin.from("brand_staff").select("id, email").in("id", staffIds),
  ]);

  const challengeIds = [...new Set((qrRewards ?? []).map((q) => q.challenge_id).filter(Boolean))];
  const enrollmentIds = [...new Set((qrRewards ?? []).map((q) => q.enrollment_id))];

  const [{ data: challenges }, { data: enrollments }] = await Promise.all([
    challengeIds.length
      ? admin.from("challenges").select("id, title").in("id", challengeIds)
      : Promise.resolve({ data: [] }),
    enrollmentIds.length
      ? admin.from("user_challenge_enrollments").select("id, user_id").in("id", enrollmentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const userIds = [...new Set((enrollments ?? []).map((e) => e.user_id))];
  const { data: users } = userIds.length
    ? await admin.from("cada_users").select("id, display_label").in("id", userIds)
    : { data: [] };

  const staffById = new Map((staff ?? []).map((s) => [s.id, s.email]));
  const qrById = new Map((qrRewards ?? []).map((q) => [q.id, q]));
  const challengeById = new Map((challenges ?? []).map((c) => [c.id, c.title]));
  const enrollmentById = new Map((enrollments ?? []).map((e) => [e.id, e.user_id]));
  const userById = new Map((users ?? []).map((u) => [u.id, u.display_label]));

  const rows: RedemptionLogRow[] = redemptions.map((row) => {
    const qr = qrById.get(row.qr_reward_id);
    const userId = qr ? enrollmentById.get(qr.enrollment_id) : undefined;

    return {
      id: row.id,
      redeemed_at: row.redeemed_at,
      challenge_id: qr?.challenge_id ?? "",
      challenge_title: qr?.challenge_id ? challengeById.get(qr.challenge_id) ?? "Challenge" : "Challenge",
      staff_email: staffById.get(row.staff_id) ?? "—",
      user_label: userId ? userById.get(userId) ?? null : null,
    };
  });

  return { rows, total: count ?? 0 };
}

async function getChallengeIds(
  admin: ReturnType<typeof createAdminClient>,
  brandId: string,
  challengeId?: string
): Promise<string[]> {
  if (challengeId) {
    const { data } = await admin
      .from("challenges")
      .select("id, status")
      .eq("id", challengeId)
      .eq("brand_id", brandId)
      .maybeSingle();
    if (!data || (data.status !== "active" && data.status !== "ended")) return [];
    return [data.id];
  }

  const { data } = await admin
    .from("challenges")
    .select("id")
    .eq("brand_id", brandId)
    .in("status", ["active", "ended"]);
  return (data ?? []).map((c) => c.id);
}

/** Call after redeem to bust cached aggregates for a brand. */
export function invalidateMetricsCache(brandId: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(`brand:${brandId}:`)) {
      cache.delete(key);
    }
  }
}
