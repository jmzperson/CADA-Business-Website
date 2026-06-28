import { expireIssuedQrRewards } from "@/lib/db/rewards";

/** Mark issued rewards past expires_at as expired. Safe to run repeatedly. */
export async function expireQrRewards(): Promise<number> {
  return expireIssuedQrRewards();
}
