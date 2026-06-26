import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, jsonError } from "@/lib/api";
import { verifyCadaAdminToken } from "@/lib/admin/auth";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    if (!verifyCadaAdminToken(request)) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: row } = await admin
      .from("challenges")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (!row) return jsonError("Challenge not found", 404);
    if (row.status !== "pending_review") {
      return jsonError("Only pending_review challenges can be approved", 409);
    }

    const { data: updated, error } = await admin
      .from("challenges")
      .update({
        status: "active",
        published_at: now,
        reviewed_at: now,
        reviewed_by: "CADA_ADMIN",
      })
      .eq("id", id)
      .select("id, title, status, published_at")
      .single();

    if (error || !updated) return jsonError(error?.message || "Approve failed", 500);

    return NextResponse.json({
      challenge: updated,
      message: "Challenge approved and live in the CADA app.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
