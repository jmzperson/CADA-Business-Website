import { NextResponse } from "next/server";
import { getChallengeById, updateChallenge } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { verifyCadaAdminToken } from "@/lib/admin/auth";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    if (!verifyCadaAdminToken(request)) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    const row = await getChallengeById(id);
    if (!row) return jsonError("Challenge not found", 404);
    if (row.status !== "pending_review") {
      return jsonError("Only pending_review challenges can be approved", 409);
    }

    const now = new Date().toISOString();
    const updated = await updateChallenge(id, {
      status: "active",
      published_at: now,
      reviewed_at: now,
      reviewed_by: "CADA_ADMIN",
    });

    if (!updated) return jsonError("Approve failed", 500);

    return NextResponse.json({
      challenge: {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        published_at: updated.published_at,
      },
      message: "Challenge approved and live in the CADA app.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
