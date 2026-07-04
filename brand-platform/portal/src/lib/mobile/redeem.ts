import {
  createRedemption,
  createRedemptionAttempt,
  getChallengeById,
  getQrRewardByTokenHash,
  getRedemptionByQrReward,
  updateQrReward,
} from "@/lib/db";
import { invalidateMetricsCache } from "@/lib/metrics/aggregate";
import { getChallengeMetrics, isAtRedemptionCap } from "@/lib/challenges";
import { expireQrRewards } from "@/lib/mobile/expire-rewards";
import { hashToken } from "@/lib/mobile/tokens";
import {
  parseTokenFromScan,
  redeemErrorMessage,
  type RedeemErrorCode,
} from "@/lib/mobile/scan-utils";

export { parseTokenFromScan, redeemErrorMessage, type RedeemErrorCode };

export type RedeemSuccess = {
  ok: true;
  status: "redeemed";
  message: string;
  redeemed_at: string;
  challenge_title: string;
};

export type RedeemFailure = {
  ok: false;
  error: RedeemErrorCode;
  httpStatus: number;
  message: string;
  redeemed_at?: string;
};

export type RedeemResult = RedeemSuccess | RedeemFailure;

/**
 * Validate and redeem a QR token.
 * Idempotent: second redeem returns already_redeemed (409), never 500.
 */
export async function redeemQrToken(params: {
  rawToken: string;
  brandId: string;
  staffId: string;
  locationId?: string;
  metadata?: Record<string, unknown>;
}): Promise<RedeemResult> {
  await expireQrRewards();

  const tokenHash = hashToken(params.rawToken);
  const reward = await getQrRewardByTokenHash(tokenHash);

  if (!reward) {
    await logAttempt(tokenHash, params.brandId, params.staffId, "invalid");
    return fail("invalid_token", 404);
  }

  if (reward.brand_id !== params.brandId) {
    await logAttempt(tokenHash, params.brandId, params.staffId, "wrong_brand");
    return fail("wrong_brand", 403);
  }

  if (reward.status === "revoked") {
    await logAttempt(tokenHash, params.brandId, params.staffId, "invalid");
    return fail("revoked", 410);
  }

  if (reward.status === "redeemed") {
    const redeemedAt = await getRedeemedAt(reward.id, reward.redeemed_at);
    await logAttempt(tokenHash, params.brandId, params.staffId, "already_redeemed");
    return fail("already_redeemed", 409, redeemedAt);
  }

  const isPastExpiry =
    reward.status === "expired" || new Date(reward.expires_at) < new Date();

  if (isPastExpiry) {
    if (reward.status === "issued") {
      await updateQrReward(reward.id, { status: "expired" });
    }
    await logAttempt(tokenHash, params.brandId, params.staffId, "expired");
    return fail("expired", 410);
  }

  const challenge = await getChallengeById(reward.challenge_id);
  const challengeId = reward.challenge_id;

  if (challenge?.max_redemptions != null && challengeId) {
    const metrics = await getChallengeMetrics([challengeId]);
    const usage = {
      redemption_count: metrics[challengeId]?.redemption_count ?? 0,
      pending_issued_count: 0,
    };
    if (isAtRedemptionCap(challenge.max_redemptions, usage)) {
      await logAttempt(tokenHash, params.brandId, params.staffId, "cap_reached");
      return fail("redemption_cap_reached", 410);
    }
  }

  if (!challengeId) {
    await logAttempt(tokenHash, params.brandId, params.staffId, "invalid");
    return fail("invalid_token", 404);
  }

  const now = new Date().toISOString();
  const challengeTitle = challenge?.title ?? "Challenge";

  if (reward.status !== "issued") {
    const redeemedAt = await getRedeemedAt(reward.id, reward.redeemed_at);
    await logAttempt(tokenHash, params.brandId, params.staffId, "already_redeemed");
    return fail("already_redeemed", 409, redeemedAt);
  }

  const updated = await updateQrReward(reward.id, { status: "redeemed", redeemed_at: now });

  if (!updated || updated.status !== "redeemed") {
    const redeemedAt = await getRedeemedAt(reward.id, null);
    await logAttempt(tokenHash, params.brandId, params.staffId, "already_redeemed");
    return fail("already_redeemed", 409, redeemedAt ?? undefined);
  }

  const existingRedemption = await getRedemptionByQrReward(reward.id);
  if (existingRedemption) {
    await logAttempt(tokenHash, params.brandId, params.staffId, "already_redeemed");
    return fail("already_redeemed", 409, existingRedemption.redeemed_at);
  }

  try {
    await createRedemption({
      qr_reward_id: reward.id,
      brand_id: params.brandId,
      staff_id: params.staffId,
      challenge_id: challengeId,
      location_id: params.locationId ?? null,
      redeemed_at: now,
      metadata: params.metadata ?? {},
    });
  } catch {
    const redeemedAt = await getRedeemedAt(reward.id, now);
    await logAttempt(tokenHash, params.brandId, params.staffId, "already_redeemed");
    return fail("already_redeemed", 409, redeemedAt ?? undefined);
  }

  await logAttempt(tokenHash, params.brandId, params.staffId, "success");
  invalidateMetricsCache(params.brandId);

  return {
    ok: true,
    status: "redeemed",
    message: "Reward redeemed",
    redeemed_at: now,
    challenge_title: challengeTitle,
  };
}

function fail(
  error: RedeemErrorCode,
  httpStatus: number,
  redeemedAt?: string | null
): RedeemFailure {
  return {
    ok: false,
    error,
    httpStatus,
    message: redeemErrorMessage(error),
    redeemed_at: redeemedAt ?? undefined,
  };
}

async function getRedeemedAt(
  qrRewardId: string,
  fallback: string | null
): Promise<string | null> {
  if (fallback) return fallback;
  const redemption = await getRedemptionByQrReward(qrRewardId);
  return redemption?.redeemed_at ?? null;
}

async function logAttempt(
  tokenHash: string,
  brandId: string,
  staffId: string,
  outcome: string
) {
  await createRedemptionAttempt({
    token_hash: tokenHash,
    brand_id: brandId,
    staff_id: staffId,
    outcome,
  });
}
