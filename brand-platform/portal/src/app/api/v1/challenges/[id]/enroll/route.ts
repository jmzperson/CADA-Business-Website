import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, jsonError } from "@/lib/api";
import { requireAppUser } from "@/lib/mobile/auth";
import { ensureCadaUser } from "@/lib/mobile/users";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const authUser = await requireAppUser(request);
    const cadaUser = await ensureCadaUser(authUser.id);
    const { id: challengeId } = await params;

    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: challenge } = await admin
      .from("challenges")
      .select(
        `
        id,
        status,
        starts_at,
        ends_at,
        brands!inner (status)
      `
      )
      .eq("id", challengeId)
      .maybeSingle();

    if (!challenge) {
      return jsonError("Challenge not found", 404);
    }

    const brand = challenge.brands as { status: string };
    if (challenge.status !== "active" || brand.status !== "active") {
      return jsonError("Challenge is not available for enrollment", 410);
    }

    if (new Date(challenge.starts_at as string) > new Date()) {
      return jsonError("Challenge has not started yet", 410);
    }

    if (challenge.ends_at && new Date(challenge.ends_at as string) <= new Date()) {
      return jsonError("Challenge has ended", 410);
    }

    const { data: existing } = await admin
      .from("user_challenge_enrollments")
      .select("id, challenge_id, status, enrolled_at")
      .eq("challenge_id", challengeId)
      .eq("user_id", cadaUser.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          enrollment_id: existing.id,
          challenge_id: existing.challenge_id,
          status: existing.status,
          enrolled_at: existing.enrolled_at,
          already_enrolled: true,
        },
        { status: 200 }
      );
    }

    const { data: enrollment, error } = await admin
      .from("user_challenge_enrollments")
      .insert({
        challenge_id: challengeId,
        user_id: cadaUser.id,
        status: "active",
      })
      .select("id, challenge_id, status, enrolled_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return jsonError("Already enrolled in this challenge", 409);
      }
      return jsonError(error.message, 500);
    }

    return NextResponse.json(
      {
        enrollment_id: enrollment.id,
        challenge_id: enrollment.challenge_id,
        status: enrollment.status,
        enrolled_at: enrollment.enrolled_at,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
