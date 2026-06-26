import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, jsonError } from "@/lib/api";
import {
  getChallengeMetrics,
  parseChallengeInput,
  serializeChallenge,
  type ChallengeRow,
} from "@/lib/challenges";

export async function GET() {
  try {
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("challenges")
      .select("*")
      .eq("brand_id", staff.brandId)
      .order("created_at", { ascending: false });

    if (error) return jsonError(error.message, 500);

    const rows = (data || []) as ChallengeRow[];
    const metrics = await getChallengeMetrics(rows.map((r) => r.id));

    return NextResponse.json({
      challenges: rows.map((row) => serializeChallenge(row, metrics[row.id])),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);
    if (staff.role !== "admin") {
      return jsonError("Only admins can create challenges", 403);
    }

    const body = await request.json();
    const { data, errors } = parseChallengeInput(body);

    if (errors.length > 0) {
      return jsonError(errors.join("; "));
    }

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("challenges")
      .insert({
        brand_id: staff.brandId,
        ...data,
        status: "draft",
      })
      .select("*")
      .single();

    if (error || !row) return jsonError(error?.message || "Failed to create challenge", 500);

    return NextResponse.json(
      { challenge: serializeChallenge(row as ChallengeRow) },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
