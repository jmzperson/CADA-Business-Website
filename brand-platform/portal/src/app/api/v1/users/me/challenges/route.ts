import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    const cadaUser = await ensureCadaUser(authUser.id);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("user_challenge_enrollments")
      .select(
        `
        id,
        challenge_id,
        status,
        enrolled_at,
        completed_at,
        completion_count,
        challenges (
          title,
          habit_type,
          offer_headline,
          offer_code,
          status,
          completion_rule,
          brand_id,
          brands (
            id,
            name,
            logo_url
          )
        )
      `
      )
      .eq("user_id", cadaUser.id)
      .order("enrolled_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const enrollmentIds = (data || []).map((e) => e.id);
    const rewardByEnrollment = new Map<string, string>();

    if (enrollmentIds.length > 0) {
      const { data: rewards } = await admin
        .from("qr_rewards")
        .select("id, enrollment_id")
        .in("enrollment_id", enrollmentIds);

      for (const r of rewards || []) {
        rewardByEnrollment.set(r.enrollment_id, r.id);
      }
    }

    const enrollments: EnrollmentSummary[] = (data || []).map((row) => {
      const challenge = row.challenges as {
        title: string;
        habit_type: string;
        offer_headline: string;
        offer_code: string | null;
        status: string;
        completion_rule: string;
        brands: { id: string; name: string; logo_url: string | null };
      } | null;

      const brand = challenge?.brands ?? { id: "", name: "", logo_url: null };
      const required = completionRequired(challenge?.completion_rule ?? "single_completion");
      const current = row.completion_count ?? 0;
      const rewardId = rewardByEnrollment.get(row.id) ?? null;

      return {
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
          id: brand.id,
          name: brand.name,
          logo_url: brand.logo_url,
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
      };
    });

    return NextResponse.json({ enrollments });
  } catch (err) {
    return handleApiError(err);
  }
}
