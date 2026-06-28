import { NextResponse } from "next/server";
import {
  getBrandById,
  getChallengeById,
  listEnrollmentsByUser,
  listQrRewardsByEnrollmentIds,
} from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { requireAppUser } from "@/lib/mobile/auth";
import { ensureCadaUser } from "@/lib/mobile/users";
import {
  completionRequired,
  type EnrollmentSummary,
} from "@/lib/mobile/serialize";
import type { HabitType } from "@/lib/challenges";

export async function GET(request: Request) {
  try {
    const authUser = await requireAppUser(request);
    const cadaUser = await ensureCadaUser(authUser.uid);

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
      const brand = challenge ? await getBrandById(challenge.brand_id) : null;

      const required = completionRequired(challenge?.completion_rule ?? "single_completion");
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
          title: challenge?.title ?? "",
          habit_type: (challenge?.habit_type ?? "custom") as HabitType,
          offer_headline: challenge?.offer_headline ?? "",
          offer_code: challenge?.offer_code ?? null,
          status: challenge?.status ?? "",
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
