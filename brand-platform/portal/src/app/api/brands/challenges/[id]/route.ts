import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, jsonError } from "@/lib/api";
import {
  challengeHasRedemptions,
  getChallengeForBrand,
  getChallengeMetrics,
  parseChallengeInput,
  serializeChallenge,
  type ChallengeInput,
  type ChallengeRow,
} from "@/lib/challenges";

type RouteParams = { params: Promise<{ id: string }> };

const ACTIVE_PATCH_FIELDS = new Set([
  "description",
  "offer_headline",
  "offer_code",
  "max_redemptions",
]);

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);

    const row = await getChallengeForBrand(id, staff.brandId);
    if (!row) return jsonError("Challenge not found", 404);

    const metrics = await getChallengeMetrics([row.id]);

    return NextResponse.json({
      challenge: serializeChallenge(row, metrics[row.id]),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);
    if (staff.role !== "admin") {
      return jsonError("Only admins can edit challenges", 403);
    }

    const row = await getChallengeForBrand(id, staff.brandId);
    if (!row) return jsonError("Challenge not found", 404);

    if (row.status === "ended") {
      return jsonError("Ended challenges cannot be edited", 409);
    }

    if (row.status === "pending_review") {
      return jsonError("Challenge is pending CADA approval and cannot be edited", 409);
    }

    const body = (await request.json()) as ChallengeInput;

    if (row.status === "active") {
      const keys = Object.keys(body);
      const disallowed = keys.filter((k) => !ACTIVE_PATCH_FIELDS.has(k));
      if (disallowed.length > 0) {
        return jsonError(
          `Active challenges only allow editing: ${[...ACTIVE_PATCH_FIELDS].join(", ")}`
        );
      }
    }

    const { data, errors } = parseChallengeInput(body, true);

    if (row.status === "draft" || row.status === "rejected") {
      // Full edit allowed; validate merged result on submit
    } else {
      delete data.title;
      delete data.habit_type;
      delete data.starts_at;
      delete data.ends_at;
    }

    if (errors.length > 0) {
      return jsonError(errors.join("; "));
    }

    if (Object.keys(data).length === 0) {
      return jsonError("No valid fields to update");
    }

    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from("challenges")
      .update(data)
      .eq("id", id)
      .eq("brand_id", staff.brandId)
      .select("*")
      .single();

    if (error || !updated) return jsonError(error?.message || "Update failed", 500);

    const metrics = await getChallengeMetrics([id]);

    return NextResponse.json({
      challenge: serializeChallenge(updated as ChallengeRow, metrics[id]),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);
    if (staff.role !== "admin") {
      return jsonError("Only admins can delete challenges", 403);
    }

    const row = await getChallengeForBrand(id, staff.brandId);
    if (!row) return jsonError("Challenge not found", 404);

    if (row.status !== "draft" && row.status !== "rejected") {
      return jsonError(
        "Only draft or rejected challenges can be deleted. End the challenge instead.",
        409
      );
    }

    if (await challengeHasRedemptions(id)) {
      return jsonError("Cannot delete a challenge with redemptions", 409);
    }

    const admin = createAdminClient();

    const { count } = await admin
      .from("user_challenge_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", id);

    if ((count ?? 0) > 0) {
      return jsonError("Cannot delete a challenge with enrollments", 409);
    }

    const { error } = await admin
      .from("challenges")
      .delete()
      .eq("id", id)
      .eq("brand_id", staff.brandId);

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
