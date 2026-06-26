import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, jsonError } from "@/lib/api";
import { verifyCadaAdminToken } from "@/lib/admin/auth";

type RouteParams = { params: Promise<{ id: string }> };
type Body = { reason?: string };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    if (!verifyCadaAdminToken(request)) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Body;
    const reason = body.reason?.trim() || null;

    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: row } = await admin
      .from("challenges")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (!row) return jsonError("Challenge not found", 404);
    if (row.status !== "pending_review") {
      return jsonError("Only pending_review challenges can be rejected", 409);
    }

    const { data: updated, error } = await admin
      .from("challenges")
      .update({
        status: "rejected",
        reviewed_at: now,
        reviewed_by: "CADA_ADMIN",
        rejection_reason: reason,
      })
      .eq("id", id)
      .select("id, title, status, rejection_reason")
      .single();

    if (error || !updated) return jsonError(error?.message || "Reject failed", 500);

    return NextResponse.json({
      challenge: updated,
      message: "Challenge rejected. Brand can edit and resubmit.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
