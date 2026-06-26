import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, jsonError } from "@/lib/api";
import { validateHabitType } from "@/lib/challenges";
import { processHabitCompleted } from "@/lib/mobile/attribution";
import { requireAppUser } from "@/lib/mobile/auth";
import { formatRewardForApi } from "@/lib/mobile/serialize";
import { ensureCadaUser } from "@/lib/mobile/users";
import { checkRateLimit } from "@/lib/mobile/rate-limit";

type Body = {
  habit_type?: string;
  completed_at?: string;
  source_event_id?: string;
  challenge_id?: string;
};

export async function POST(request: Request) {
  try {
    const authUser = await requireAppUser(request);
    const cadaUser = await ensureCadaUser(authUser.id);

    const body = (await request.json()) as Body;
    const habitType = body.habit_type?.trim();
    const completedAt = body.completed_at?.trim();
    const sourceEventId = body.source_event_id?.trim();
    const challengeId = body.challenge_id?.trim();

    if (!habitType || !completedAt || !sourceEventId) {
      return jsonError("habit_type, completed_at, and source_event_id are required");
    }

    if (!validateHabitType(habitType)) {
      return jsonError("invalid habit_type");
    }

    const rate = checkRateLimit(`habit-completed:${cadaUser.id}`, 120, 60_000);
    if (!rate.allowed) {
      return jsonError("Rate limit exceeded", 429);
    }

    const result = await processHabitCompleted(cadaUser.id, {
      habit_type: habitType,
      completed_at: completedAt,
      source_event_id: sourceEventId,
      challenge_id: challengeId,
    });

    return NextResponse.json({
      ...result,
      reward: result.reward ? formatRewardForApi(result.reward) : undefined,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
