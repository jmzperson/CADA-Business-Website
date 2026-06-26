import { createAdminClient } from "@/lib/supabase/admin";
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
 * Idempotent: one qr_rewards row per enrollment (UNIQUE on enrollment_id).
 *
 * Token design: opaque random (256-bit) + SHA-256 hash in DB.
 * See docs/qr-integration-guide-ios.md for JWT tradeoff rationale.
 */
export async function issueQrReward(params: {
  enrollmentId: string;
  brandId: string;
  userId: string;
  challengeId: string;
}): Promise<IssuedReward> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("qr_rewards")
    .select("*")
    .eq("enrollment_id", params.enrollmentId)
    .maybeSingle();

  if (existing) {
    return toIssuedReward(existing);
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + qrTtlHours() * 60 * 60 * 1000);

  const { data: created, error } = await admin
    .from("qr_rewards")
    .insert({
      enrollment_id: params.enrollmentId,
      brand_id: params.brandId,
      user_id: params.userId,
      challenge_id: params.challengeId,
      token_hash: tokenHash,
      token_ciphertext: encryptToken(rawToken),
      status: "issued",
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await admin
        .from("qr_rewards")
        .select("*")
        .eq("enrollment_id", params.enrollmentId)
        .single();
      if (raced) return toIssuedReward(raced);
    }
    throw new Error(error.message);
  }

  return toIssuedReward(created, rawToken);
}

export async function getRewardForUser(
  rewardId: string,
  cadaUserId: string
): Promise<IssuedReward | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("qr_rewards")
    .select("*")
    .eq("id", rewardId)
    .eq("user_id", cadaUserId)
    .maybeSingle();

  if (!data) return null;
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
