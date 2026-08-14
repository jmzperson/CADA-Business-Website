import { NextResponse } from "next/server";
import {
  getBrandById,
  getChallengeById,
  listEnrollmentsByUser,
  listQrRewardsByEnrollmentIds,
} from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { requireAppUser } from "@/lib/mobile/auth";
import {
  durationDaysFromRange,
  habitDisplayName,
  type HabitType,
} from "@/lib/challenges";
import {
  completionRequired,
  type EnrollmentSummary,
} from "@/lib/mobile/serialize";

export async function GET(request: Request) {
  try {
    const { cadaUser } = await requireAppUser(request);

    const enrollments = await listEnrollmentsByUser(cadaUser.id);
    enrollments.sort((a, b) => b.enrolled_at.localeCompare(a.enrolled_at));

    const enrollmentIds = enrollments.map((e) => e.id);
    const rewardByEnrollment = new Map<string, string>();

    if (enrollmentIds.length > 0) {
      const rewards = await listQrRewardsByEnrollmentIds(enrollmentIds);
      for (const r of rewards) {
        rewardByEnrollment.set(r.enrollment_id, r.id);
      }
    }

    const summaries: EnrollmentSummary[] = [];
    for (const row of enrollments) {
      const challenge = await getChallengeById(row.challenge_id);
      if (!challenge || challenge.status !== "active") continue;
      const brand = await getBrandById(challenge.brand_id);

      const required = completionRequired(challenge.completion_rule ?? "single_completion");
      const current = row.completion_count ?? 0;
      const rewardId = rewardByEnrollment.get(row.id) ?? null;

      summaries.push({
        enrollment_id: row.id,
        challenge_id: row.challenge_id,
        status: row.status,
        enrolled_at: row.enrolled_at,
        completed_at: row.completed_at,
        completion_count: current,
        challenge: {
          title: challenge.title,
          description: challenge.description,
          habit_type: challenge.habit_type as HabitType,
          habit_label: habitDisplayName(challenge.habit_type),
          offer_headline: challenge.offer_headline,
          offer_code: challenge.offer_code,
          status: challenge.status,
          starts_at: challenge.starts_at,
          ends_at: challenge.ends_at,
          join_window_days: challenge.join_window_days ?? null,
          duration_days: durationDaysFromRange(challenge.starts_at, challenge.ends_at),
        },
        brand: {
          id: brand?.id ?? "",
          name: brand?.name ?? "",
          logo_url: brand?.logo_url ?? null,
        },
        progress: {
          rule: challenge?.completion_rule ?? "single_completion",
          required,
          current,
          completed: row.status === "completed" || current >= required,
        },
        reward: {
          issued: Boolean(rewardId),
          reward_id: rewardId,
        },
      });
    }

    return NextResponse.json({ enrollments: summaries });
  } catch (err) {
    return handleApiError(err);
  }
}
