import { createAdminClient } from "@/lib/supabase/admin";
import type { HabitType } from "@/lib/challenges";
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
};

type EnrollmentWithChallenge = {
  id: string;
  challenge_id: string;
  user_id: string;
  status: string;
  completion_count: number;
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
  const admin = createAdminClient();

  const { data: existingEvent } = await admin
    .from("habit_completion_events")
    .select("id, enrollment_id, completed_at")
    .eq("user_id", cadaUserId)
    .eq("source_event_id", input.source_event_id)
    .maybeSingle();

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
    await admin.from("habit_completion_events").insert({
      user_id: cadaUserId,
      habit_type: input.habit_type,
      completed_at: completedAt.toISOString(),
      source_event_id: input.source_event_id,
      enrollment_id: null,
    });
    return { attributed: false, reason: "no_matching_enrollment" };
  }

  if (enrollment.status === "completed") {
    await admin.from("habit_completion_events").insert({
      user_id: cadaUserId,
      habit_type: input.habit_type,
      completed_at: completedAt.toISOString(),
      source_event_id: input.source_event_id,
      enrollment_id: null,
    });
    return { attributed: false, reason: "enrollment_already_completed" };
  }

  if (enrollment.status === "dropped") {
    await admin.from("habit_completion_events").insert({
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
    await admin.from("habit_completion_events").insert({
      user_id: cadaUserId,
      habit_type: input.habit_type,
      completed_at: completedAt.toISOString(),
      source_event_id: input.source_event_id,
      enrollment_id: null,
    });
    return { attributed: false, reason: "daily_cap_reached" };
  }

  const { error: insertError } = await admin.from("habit_completion_events").insert({
    user_id: cadaUserId,
    habit_type: input.habit_type,
    completed_at: completedAt.toISOString(),
    source_event_id: input.source_event_id,
    enrollment_id: enrollment.id,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      if (insertError.message.includes("habit_completion_events_source_unique")) {
        return replayFromExistingEvent(cadaUserId, null, input.source_event_id);
      }
      return { attributed: false, reason: "daily_cap_reached" };
    }
    throw new Error(insertError.message);
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

  const { data: updatedEnrollment, error: updateError } = await admin
    .from("user_challenge_enrollments")
    .update(enrollmentUpdate)
    .eq("id", enrollment.id)
    .select("id, status, completion_count")
    .single();

  if (updateError || !updatedEnrollment) {
    throw new Error(updateError?.message || "Failed to update enrollment");
  }

  let reward: IssuedReward | undefined;
  if (isComplete) {
    reward = await issueQrReward({
      enrollmentId: enrollment.id,
      brandId: enrollment.challenges.brand_id,
      userId: cadaUserId,
      challengeId: enrollment.challenge_id,
    });
  }

  return {
    attributed: true,
    enrollment_id: updatedEnrollment.id,
    enrollment_status: updatedEnrollment.status,
    completion_count: updatedEnrollment.completion_count,
    reward,
  };
}

async function replayFromExistingEvent(
  cadaUserId: string,
  enrollmentId: string | null,
  sourceEventId: string
): Promise<HabitCompletedResult> {
  const admin = createAdminClient();

  const { data: event } = await admin
    .from("habit_completion_events")
    .select("enrollment_id")
    .eq("user_id", cadaUserId)
    .eq("source_event_id", sourceEventId)
    .single();

  const eid = event?.enrollment_id ?? enrollmentId;
  if (!eid) {
    return { attributed: false, idempotent_replay: true, reason: "no_attribution" };
  }

  const { data: enrollment } = await admin
    .from("user_challenge_enrollments")
    .select("id, status, completion_count, challenges(brand_id)")
    .eq("id", eid)
    .maybeSingle();

  if (!enrollment) {
    return { attributed: false, idempotent_replay: true, reason: "no_attribution" };
  }

  let reward: IssuedReward | undefined;
  if (enrollment.status === "completed") {
    const brandId =
      enrollment.challenges &&
      typeof enrollment.challenges === "object" &&
      "brand_id" in enrollment.challenges
        ? (enrollment.challenges as { brand_id: string }).brand_id
        : "";

    const { data: enrollmentRow } = await admin
      .from("user_challenge_enrollments")
      .select("challenge_id, user_id")
      .eq("id", enrollment.id)
      .single();

    if (brandId && enrollmentRow) {
      reward = await issueQrReward({
        enrollmentId: enrollment.id,
        brandId,
        userId: enrollmentRow.user_id,
        challengeId: enrollmentRow.challenge_id,
      });
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
  const admin = createAdminClient();
  const now = completedAt.toISOString();

  let query = admin
    .from("user_challenge_enrollments")
    .select(
      `
      id,
      challenge_id,
      user_id,
      status,
      completion_count,
      enrolled_at,
      challenges!inner (
        id,
        brand_id,
        habit_type,
        status,
        completion_rule,
        starts_at,
        ends_at
      )
    `
    )
    .eq("user_id", cadaUserId)
    .eq("status", "active")
    .eq("challenges.habit_type", habitType)
    .eq("challenges.status", "active")
    .lte("challenges.starts_at", now);

  if (challengeId) {
    query = query.eq("challenge_id", challengeId);
  }

  const { data } = await query.order("enrolled_at", { ascending: true });

  const rows = (data || []) as unknown as EnrollmentWithChallenge[];

  return (
    rows.find((row) => {
      const c = row.challenges;
      if (!c) return false;
      if (c.ends_at && new Date(c.ends_at) <= completedAt) return false;
      return true;
    }) ?? null
  );
}

async function hasAttributedCompletionOnDate(
  enrollmentId: string,
  dateKey: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("habit_completion_events")
    .select("id, completed_at")
    .eq("enrollment_id", enrollmentId);

  return (data || []).some((row) => utcDateKey(row.completed_at) === dateKey);
}
