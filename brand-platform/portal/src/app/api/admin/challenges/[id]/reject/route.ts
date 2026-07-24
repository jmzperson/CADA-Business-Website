import { NextResponse } from "next/server";
import { getChallengeById, updateChallenge } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { requireCadaAdminAccess } from "@/lib/admin/auth";

type RouteParams = { params: Promise<{ id: string }> };
type Body = { reason?: string };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const access = await requireCadaAdminAccess(request);
    if (!access.ok) {
      return jsonError(
        access.status === 403 ? "CADA admin access required" : "Unauthorized",
        access.status
      );
    }
    const admin = access.admin;

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Body;
    const reason = body.reason?.trim() || null;

    const row = await getChallengeById(id);
    if (!row) return jsonError("Challenge not found", 404);
    if (row.status !== "pending_review") {
      return jsonError("Only pending_review challenges can be rejected", 409);
    }

    const now = new Date().toISOString();
    const updated = await updateChallenge(id, {
      status: "rejected",
      reviewed_at: now,
      reviewed_by: admin.email,
      rejection_reason: reason,
    });

    if (!updated) return jsonError("Reject failed", 500);

    return NextResponse.json({
      challenge: {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        rejection_reason: updated.rejection_reason,
      },
      message: "Challenge rejected. Brand can edit and resubmit.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
