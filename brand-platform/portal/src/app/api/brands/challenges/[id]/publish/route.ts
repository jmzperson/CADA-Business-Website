import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { getBrandById } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { getChallengeMetrics, serializeChallenge } from "@/lib/challenges";
import { submitChallengeForReview } from "@/lib/challenges/submit-for-review";

type RouteParams = { params: Promise<{ id: string }> };

/** Submit challenge for CADA admin review (does not go live in app). */
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);
    if (staff.role !== "admin") {
      return jsonError("Only admins can submit challenges for review", 403);
    }

    const brand = await getBrandById(staff.brandId);

    const result = await submitChallengeForReview({
      challengeId: id,
      brandId: staff.brandId,
      brandName: brand?.name ?? "Unknown brand",
      submittedByEmail: staff.email,
    });

    if (!result.ok) {
      return jsonError(result.error, result.status);
    }

    const metrics = await getChallengeMetrics([id]);

    return NextResponse.json({
      challenge: serializeChallenge(result.challenge, metrics[id]),
      message: "Submitted for CADA approval.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
