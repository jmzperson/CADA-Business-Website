import { challengeCanIssueReward } from "@/lib/challenges";
import {
  createQrReward,
  getQrRewardByEnrollment,
  getQrRewardById,
} from "@/lib/db";
import {
  buildQrUrl,
  decryptToken,
  encryptToken,
  generateRawToken,
  hashToken,
} from "@/lib/mobile/tokens";

export type IssuedReward = {
  id: string;
  enrollment_id: string;
  brand_id: string;
  challenge_id: string;
  status: string;
  issued_at: string;
  expires_at: string;
  qr_url: string;
};

export function qrTtlHours(): number {
  const hours = Number(process.env.QR_TTL_HOURS || 24);
  return Number.isFinite(hours) && hours > 0 ? hours : 24;
}

/**
 * Issue QR reward when enrollment reaches `completed`.
 * Idempotent: one qr_rewards row per enrollment.
 */
export async function issueQrReward(params: {
  enrollmentId: string;
  brandId: string;
  userId: string;
  challengeId: string;
}): Promise<IssuedReward> {
  const existing = await getQrRewardByEnrollment(params.enrollmentId);
  if (existing) {
    return toIssuedReward(existing);
  }

  const canIssue = await challengeCanIssueReward(params.challengeId);
  if (!canIssue) {
    throw new Error("redemption_cap_reached");
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + qrTtlHours() * 60 * 60 * 1000);

  try {
    const created = await createQrReward({
      enrollment_id: params.enrollmentId,
      brand_id: params.brandId,
      user_id: params.userId,
      challenge_id: params.challengeId,
      token_hash: tokenHash,
      token_ciphertext: encryptToken(rawToken),
      status: "issued",
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      redeemed_at: null,
    });
    return toIssuedReward(created, rawToken);
  } catch (err) {
    const raced = await getQrRewardByEnrollment(params.enrollmentId);
    if (raced) return toIssuedReward(raced);
    throw err;
  }
}

export async function getRewardForUser(
  rewardId: string,
  cadaUserId: string
): Promise<IssuedReward | null> {
  const data = await getQrRewardById(rewardId);
  if (!data || data.user_id !== cadaUserId) return null;
  return toIssuedReward(data);
}

function toIssuedReward(
  row: {
    id: string;
    enrollment_id: string;
    brand_id: string;
    challenge_id: string | null;
    status: string;
    issued_at: string;
    expires_at: string;
    token_ciphertext: string | null;
  },
  rawToken?: string
): IssuedReward {
  let token = rawToken;
  if (!token && row.token_ciphertext) {
    token = decryptToken(row.token_ciphertext);
  }
  if (!token) {
    throw new Error("Reward token unavailable");
  }

  return {
    id: row.id,
    enrollment_id: row.enrollment_id,
    brand_id: row.brand_id,
    challenge_id: row.challenge_id ?? "",
    status: row.status,
    issued_at: row.issued_at,
    expires_at: row.expires_at,
    qr_url: buildQrUrl(token),
  };
}

export function serializeRewardResponse(
  reward: IssuedReward,
  meta: {
    brand_name: string;
    challenge_title: string;
    offer_headline: string;
    offer_code: string | null;
  }
) {
  const expired =
    reward.status === "expired" ||
    (reward.status === "issued" && new Date(reward.expires_at) < new Date());

  return {
    id: reward.id,
    enrollment_id: reward.enrollment_id,
    brand_id: reward.brand_id,
    challenge_id: reward.challenge_id,
    status: expired ? "expired" : reward.status,
    issued_at: reward.issued_at,
    expires_at: reward.expires_at,
    qr_url: expired || reward.status === "redeemed" || reward.status === "revoked" ? null : reward.qr_url,
    qr_payload: expired || reward.status === "redeemed" || reward.status === "revoked" ? null : reward.qr_url,
    brand_name: meta.brand_name,
    challenge_title: meta.challenge_title,
    offer_headline: meta.offer_headline,
    offer_code: meta.offer_code,
  };
}
