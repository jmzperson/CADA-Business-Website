import { createAdminClient } from "@/lib/supabase/admin";
import { invalidateMetricsCache } from "@/lib/metrics/aggregate";
import { expireQrRewards } from "@/lib/mobile/expire-rewards";
import { hashToken } from "@/lib/mobile/tokens";

export type RedeemErrorCode =
  | "invalid_token"
  | "expired"
  | "already_redeemed"
  | "wrong_brand"
  | "revoked"
  | "unauthorized";

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

const ERROR_MESSAGES: Record<RedeemErrorCode, string> = {
  invalid_token: "QR not recognized",
  expired: "This reward has expired",
  already_redeemed: "Already used",
  wrong_brand: "Not valid at this business",
  revoked: "This reward is no longer valid",
  unauthorized: "Sign in as brand staff to scan",
};

export function redeemErrorMessage(code: RedeemErrorCode): string {
  return ERROR_MESSAGES[code];
}

/** Extract raw token from scanned URL or pasted value. */
export function parseTokenFromScan(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      const rIndex = parts.indexOf("r");
      if (rIndex >= 0 && parts[rIndex + 1]) {
        return parts[rIndex + 1];
      }
      return parts[parts.length - 1] ?? trimmed;
    }
  } catch {
    // not a URL — use as raw token
  }

  return trimmed;
}

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

  const admin = createAdminClient();
  const tokenHash = hashToken(params.rawToken);

  const { data: reward } = await admin
    .from("qr_rewards")
    .select(
      `
      id,
      brand_id,
      status,
      expires_at,
      redeemed_at,
      enrollment_id,
      challenges (title)
    `
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!reward) {
    await logAttempt(admin, tokenHash, params.brandId, params.staffId, "invalid");
    return fail("invalid_token", 404);
  }

  if (reward.brand_id !== params.brandId) {
    await logAttempt(admin, tokenHash, params.brandId, params.staffId, "wrong_brand");
    return fail("wrong_brand", 403);
  }

  if (reward.status === "revoked") {
    await logAttempt(admin, tokenHash, params.brandId, params.staffId, "invalid");
    return fail("revoked", 410);
  }

  if (reward.status === "redeemed") {
    const redeemedAt = await getRedeemedAt(admin, reward.id, reward.redeemed_at);
    await logAttempt(admin, tokenHash, params.brandId, params.staffId, "already_redeemed");
    return fail("already_redeemed", 409, redeemedAt);
  }

  const isPastExpiry =
    reward.status === "expired" || new Date(reward.expires_at as string) < new Date();

  if (isPastExpiry) {
    if (reward.status === "issued") {
      await admin.from("qr_rewards").update({ status: "expired" }).eq("id", reward.id);
    }
    await logAttempt(admin, tokenHash, params.brandId, params.staffId, "expired");
    return fail("expired", 410);
  }

  const now = new Date().toISOString();
  const challengeTitle = challengeTitleFrom(reward.challenges);

  const { data: updated, error: rewardError } = await admin
    .from("qr_rewards")
    .update({ status: "redeemed", redeemed_at: now })
    .eq("id", reward.id)
    .eq("status", "issued")
    .select("id")
    .maybeSingle();

  if (rewardError) {
    const redeemedAt = await getRedeemedAt(admin, reward.id, null);
    await logAttempt(admin, tokenHash, params.brandId, params.staffId, "already_redeemed");
    return fail("already_redeemed", 409, redeemedAt ?? undefined);
  }

  if (!updated) {
    const redeemedAt = await getRedeemedAt(admin, reward.id, null);
    await logAttempt(admin, tokenHash, params.brandId, params.staffId, "already_redeemed");
    return fail("already_redeemed", 409, redeemedAt ?? undefined);
  }

  const { error: redemptionError } = await admin.from("redemptions").insert({
    qr_reward_id: reward.id,
    brand_id: params.brandId,
    staff_id: params.staffId,
    location_id: params.locationId ?? null,
    redeemed_at: now,
    metadata: params.metadata ?? {},
  });

  if (redemptionError) {
    if (redemptionError.code === "23505") {
      const redeemedAt = await getRedeemedAt(admin, reward.id, now);
      await logAttempt(admin, tokenHash, params.brandId, params.staffId, "already_redeemed");
      return fail("already_redeemed", 409, redeemedAt ?? undefined);
    }
    throw new Error(redemptionError.message);
  }

  await logAttempt(admin, tokenHash, params.brandId, params.staffId, "success");

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

function challengeTitleFrom(challenges: unknown): string {
  if (challenges && typeof challenges === "object" && "title" in challenges) {
    return (challenges as { title: string }).title;
  }
  return "Challenge";
}

async function getRedeemedAt(
  admin: ReturnType<typeof createAdminClient>,
  qrRewardId: string,
  fallback: string | null
): Promise<string | null> {
  if (fallback) return fallback;

  const { data: redemption } = await admin
    .from("redemptions")
    .select("redeemed_at")
    .eq("qr_reward_id", qrRewardId)
    .maybeSingle();

  return redemption?.redeemed_at ?? null;
}

async function logAttempt(
  admin: ReturnType<typeof createAdminClient>,
  tokenHash: string,
  brandId: string,
  staffId: string,
  outcome: string
) {
  await admin.from("redemption_attempts").insert({
    token_hash: tokenHash,
    brand_id: brandId,
    staff_id: staffId,
    outcome,
  });
}
