import {
  countRedemptionsByChallenge,
  expireEndedChallenges as expireEndedChallengesDb,
  getChallengeById,
  getChallengeForBrand as getChallengeForBrandDb,
  listEnrollmentsByChallengeIds,
  listIssuedQrRewardsByChallenge,
  listRedemptionsByChallengeIds,
} from "@/lib/db";

export {
  HABIT_TYPES,
  type HabitType,
  type ChallengeStatus,
  type ChallengeRow,
  type ChallengeInput,
  type ChallengeMetrics,
  type RedemptionUsage,
  serializeChallenge,
  validateHabitType,
  parseChallengeInput,
  validatePublishFields,
  isChallengeInDiscoveryWindow,
  isChallengeJoinable,
  isAtRedemptionCap,
  spotsRemaining,
} from "@/lib/challenge-constants";

import type { ChallengeMetrics, ChallengeRow, RedemptionUsage } from "@/lib/challenge-constants";
import { isAtRedemptionCap } from "@/lib/challenge-constants";

const emptyMetrics = (): ChallengeMetrics => ({
  enrolled_count: 0,
  completion_count: 0,
  redemption_count: 0,
});

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
