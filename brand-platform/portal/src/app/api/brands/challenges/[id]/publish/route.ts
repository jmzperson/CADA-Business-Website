import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, jsonError } from "@/lib/api";
import {
  getChallengeForBrand,
  getChallengeMetrics,
  serializeChallenge,
  validatePublishFields,
  type ChallengeRow,
} from "@/lib/challenges";

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

    const row = await getChallengeForBrand(id, staff.brandId);
    if (!row) return jsonError("Challenge not found", 404);

    if (row.status !== "draft" && row.status !== "rejected") {
      return jsonError("Only draft or rejected challenges can be submitted for review", 409);
    }

    const errors = validatePublishFields(row);
    if (errors.length > 0) {
      return jsonError(`Cannot submit: ${errors.join("; ")}`);
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: updated, error } = await admin
      .from("challenges")
      .update({
        status: "pending_review",
        submitted_at: now,
        rejection_reason: null,
        reviewed_at: null,
        reviewed_by: null,
      })
      .eq("id", id)
      .eq("brand_id", staff.brandId)
      .select("*")
      .single();

    if (error || !updated) return jsonError(error?.message || "Submit failed", 500);

    const metrics = await getChallengeMetrics([id]);

    return NextResponse.json({
      challenge: serializeChallenge(updated as ChallengeRow, metrics[id]),
      message: "Submitted for CADA approval.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
