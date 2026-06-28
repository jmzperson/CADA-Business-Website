import { NextResponse } from "next/server";
import {
  createEnrollment,
  getBrandById,
  getChallengeById,
  getEnrollmentByChallengeAndUser,
} from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import {
  expireEndedChallenges,
  getRedemptionUsageByChallenge,
  isAtRedemptionCap,
  isChallengeInDiscoveryWindow,
} from "@/lib/challenges";
import { requireAppUser } from "@/lib/mobile/auth";
import { ensureCadaUser } from "@/lib/mobile/users";
import { nowIso } from "@/lib/db/brands";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const authUser = await requireAppUser(request);
    const cadaUser = await ensureCadaUser(authUser.uid);
    const { id: challengeId } = await params;

    await expireEndedChallenges();

    const challenge = await getChallengeById(challengeId);
    if (!challenge) {
      return jsonError("Challenge not found", 404);
    }

    const brand = await getBrandById(challenge.brand_id);
    if (challenge.status !== "active" || !brand || brand.status !== "active") {
      return jsonError("Challenge is not available for enrollment", 410);
    }

    if (!isChallengeInDiscoveryWindow(challenge)) {
      return jsonError("Challenge is not available for enrollment", 410);
    }

    const usage = (await getRedemptionUsageByChallenge([challengeId]))[challengeId];
    if (isAtRedemptionCap(challenge.max_redemptions, usage)) {
      return jsonError("Challenge redemption cap reached", 410);
    }

    const existing = await getEnrollmentByChallengeAndUser(challengeId, cadaUser.id);

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

    try {
      const enrollment = await createEnrollment({
        challenge_id: challengeId,
        user_id: cadaUser.id,
        status: "active",
        enrolled_at: nowIso(),
        completed_at: null,
        completion_count: 0,
      });

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
      const raced = await getEnrollmentByChallengeAndUser(challengeId, cadaUser.id);
      if (raced) {
        return jsonError("Already enrolled in this challenge", 409);
      }
      throw err;
    }
  } catch (err) {
    return handleApiError(err);
  }
}
