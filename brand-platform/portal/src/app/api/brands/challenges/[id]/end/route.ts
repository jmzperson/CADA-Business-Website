import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { updateChallenge } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import {
  getChallengeForBrand,
  getChallengeMetrics,
  serializeChallenge,
  type ChallengeRow,
} from "@/lib/challenges";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);
    if (staff.role !== "admin") {
      return jsonError("Only admins can end challenges", 403);
    }

    const row = await getChallengeForBrand(id, staff.brandId);
    if (!row) return jsonError("Challenge not found", 404);

    if (row.status !== "active") {
      return jsonError("Only active challenges can be ended", 409);
    }

    const now = new Date().toISOString();
    const endsAt =
      row.ends_at && new Date(row.ends_at) < new Date() ? row.ends_at : now;

    const updated = await updateChallenge(id, {
      status: "ended",
      ends_at: endsAt,
    });

    if (!updated) return jsonError("Failed to end challenge", 500);

    const metrics = await getChallengeMetrics([id]);

    return NextResponse.json({
      challenge: serializeChallenge(updated as ChallengeRow, metrics[id]),
      message: "Challenge ended. It is no longer visible in the app.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
