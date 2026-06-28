import type { HabitType } from "@/lib/challenges";
import { challengeCanIssueReward } from "@/lib/challenges";
import {
  createHabitEvent,
  getChallengeById,
  getEnrollmentById,
  getHabitEventBySource,
  listEnrollmentsByUser,
  listHabitEventsByEnrollment,
  updateEnrollment,
} from "@/lib/db";
import { issueQrReward, type IssuedReward } from "@/lib/mobile/rewards";
import { completionRequired } from "@/lib/mobile/serialize";

export type HabitCompletedInput = {
  habit_type: string;
  completed_at: string;
  source_event_id: string;
  challenge_id?: string;
};

export type HabitCompletedResult = {
  attributed: boolean;
  reason?: string;
  idempotent_replay?: boolean;
  enrollment_id?: string;
  enrollment_status?: string;
  completion_count?: number;
  reward?: IssuedReward;
  reward_blocked_reason?: string;
};

type EnrollmentWithChallenge = {
  id: string;
  challenge_id: string;
  user_id: string;
  status: string;
  completion_count: number;
  enrolled_at: string;
  challenges: {
    id: string;
    brand_id: string;
    habit_type: string;
    status: string;
    completion_rule: string;
    starts_at: string;
    ends_at: string | null;
  };
};

function utcDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export async function processHabitCompleted(
  cadaUserId: string,
  input: HabitCompletedInput
): Promise<HabitCompletedResult> {
  const existingEvent = await getHabitEventBySource(cadaUserId, input.source_event_id);

  if (existingEvent) {
    return replayFromExistingEvent(cadaUserId, existingEvent.enrollment_id, input.source_event_id);
  }

  const completedAt = new Date(input.completed_at);
  if (Number.isNaN(completedAt.getTime())) {
    return { attributed: false, reason: "invalid_completed_at" };
  }

  const enrollment = await findEnrollmentToAttribute(
    cadaUserId,
    input.habit_type as HabitType,
    input.challenge_id,
    completedAt
  );

  if (!enrollment) {
    await createHabitEvent({
      user_id: cadaUserId,
      habit_type: input.habit_type,
      completed_at: completedAt.toISOString(),
      source_event_id: input.source_event_id,
      enrollment_id: null,
    });
    return { attributed: false, reason: "no_matching_enrollment" };
  }

  if (enrollment.status === "completed") {
    await createHabitEvent({
      user_id: cadaUserId,
      habit_type: input.habit_type,
      completed_at: completedAt.toISOString(),
      source_event_id: input.source_event_id,
      enrollment_id: null,
    });
    return { attributed: false, reason: "enrollment_already_completed" };
  }

  if (enrollment.status === "dropped") {
    await createHabitEvent({
      user_id: cadaUserId,
      habit_type: input.habit_type,
      completed_at: completedAt.toISOString(),
      source_event_id: input.source_event_id,
      enrollment_id: null,
    });
    return { attributed: false, reason: "enrollment_not_active" };
  }

  const dailyBlocked = await hasAttributedCompletionOnDate(
    enrollment.id,
    utcDateKey(completedAt.toISOString())
  );
  if (dailyBlocked) {
    await createHabitEvent({
      user_id: cadaUserId,
      habit_type: input.habit_type,
      completed_at: completedAt.toISOString(),
      source_event_id: input.source_event_id,
      enrollment_id: null,
    });
    return { attributed: false, reason: "daily_cap_reached" };
  }

  try {
    await createHabitEvent({
      user_id: cadaUserId,
      habit_type: input.habit_type,
      completed_at: completedAt.toISOString(),
      source_event_id: input.source_event_id,
      enrollment_id: enrollment.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("already exists") || message.includes("ALREADY_EXISTS")) {
      return replayFromExistingEvent(cadaUserId, null, input.source_event_id);
    }
    throw err;
  }

  const rule = enrollment.challenges.completion_rule;
  const required = completionRequired(rule);
  const newCount = enrollment.completion_count + 1;
  const isComplete = newCount >= required;

  const enrollmentUpdate: Record<string, unknown> = {
    completion_count: newCount,
  };

  if (isComplete) {
    enrollmentUpdate.status = "completed";
    enrollmentUpdate.completed_at = completedAt.toISOString();
  }

  const updatedEnrollment = await updateEnrollment(enrollment.id, enrollmentUpdate);
  if (!updatedEnrollment) {
    throw new Error("Failed to update enrollment");
  }

  let reward: IssuedReward | undefined;
  let rewardBlockedReason: string | undefined;
  if (isComplete) {
    const canIssue = await challengeCanIssueReward(enrollment.challenge_id);
    if (canIssue) {
      reward = await issueQrReward({
        enrollmentId: enrollment.id,
        brandId: enrollment.challenges.brand_id,
        userId: cadaUserId,
        challengeId: enrollment.challenge_id,
      });
    } else {
      rewardBlockedReason = "redemption_cap_reached";
    }
  }

  return {
    attributed: true,
    enrollment_id: updatedEnrollment.id,
    enrollment_status: updatedEnrollment.status,
    completion_count: updatedEnrollment.completion_count,
    reward,
    reward_blocked_reason: rewardBlockedReason,
  };
}

async function replayFromExistingEvent(
  cadaUserId: string,
  enrollmentId: string | null,
  sourceEventId: string
): Promise<HabitCompletedResult> {
  const event = await getHabitEventBySource(cadaUserId, sourceEventId);
  const eid = event?.enrollment_id ?? enrollmentId;
  if (!eid) {
    return { attributed: false, idempotent_replay: true, reason: "no_attribution" };
  }

  const enrollment = await getEnrollmentById(eid);
  if (!enrollment) {
    return { attributed: false, idempotent_replay: true, reason: "no_attribution" };
  }

  let reward: IssuedReward | undefined;
  if (enrollment.status === "completed") {
    const challenge = await getChallengeById(enrollment.challenge_id);
    const brandId = challenge?.brand_id ?? "";

    if (brandId) {
      const canIssue = await challengeCanIssueReward(enrollment.challenge_id);
      if (canIssue) {
        reward = await issueQrReward({
          enrollmentId: enrollment.id,
          brandId,
          userId: enrollment.user_id,
          challengeId: enrollment.challenge_id,
        });
      }
    }
  }

  return {
    attributed: Boolean(event?.enrollment_id),
    idempotent_replay: true,
    enrollment_id: enrollment.id,
    enrollment_status: enrollment.status,
    completion_count: enrollment.completion_count,
    reward,
  };
}

async function findEnrollmentToAttribute(
  cadaUserId: string,
  habitType: HabitType,
  challengeId: string | undefined,
  completedAt: Date
): Promise<EnrollmentWithChallenge | null> {
  const now = completedAt.toISOString();
  const enrollments = await listEnrollmentsByUser(cadaUserId);

  const candidates: EnrollmentWithChallenge[] = [];
  for (const row of enrollments) {
    if (row.status !== "active") continue;
    if (challengeId && row.challenge_id !== challengeId) continue;

    const challenge = await getChallengeById(row.challenge_id);
    if (!challenge) continue;
    if (challenge.habit_type !== habitType) continue;
    if (challenge.status !== "active") continue;
    if (challenge.starts_at > now) continue;
    if (challenge.ends_at && new Date(challenge.ends_at) <= completedAt) continue;

    candidates.push({
      id: row.id,
      challenge_id: row.challenge_id,
      user_id: row.user_id,
      status: row.status,
      completion_count: row.completion_count,
      enrolled_at: row.enrolled_at,
      challenges: {
        id: challenge.id,
        brand_id: challenge.brand_id,
        habit_type: challenge.habit_type,
        status: challenge.status,
        completion_rule: challenge.completion_rule,
        starts_at: challenge.starts_at,
        ends_at: challenge.ends_at,
      },
    });
  }

  candidates.sort((a, b) => a.enrolled_at.localeCompare(b.enrolled_at));
  return candidates[0] ?? null;
}

async function hasAttributedCompletionOnDate(
  enrollmentId: string,
  dateKey: string
): Promise<boolean> {
  const events = await listHabitEventsByEnrollment(enrollmentId);
  return events.some((row) => utcDateKey(row.completed_at) === dateKey);
}
