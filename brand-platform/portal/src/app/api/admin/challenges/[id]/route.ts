import { NextResponse } from "next/server";
import { getBrandById, getChallengeById } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { verifyCadaAdminToken } from "@/lib/admin/auth";
import { habitLabel } from "@/lib/challenge-form";
import { getChallengeMetrics, serializeChallenge, type ChallengeRow } from "@/lib/challenges";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    if (!verifyCadaAdminToken(request)) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    const row = await getChallengeById(id);
    if (!row) return jsonError("Challenge not found", 404);

    const brand = await getBrandById(row.brand_id);
    const metrics = await getChallengeMetrics([id]);
    const challenge = serializeChallenge(row as ChallengeRow, metrics[id]);

    return NextResponse.json({
      challenge: {
        ...challenge,
        habit_label: habitLabel(challenge.habit_type),
        brand_id: brand?.id ?? "",
        brand_name: brand?.name ?? "—",
        brand_slug: brand?.slug ?? "",
        brand_logo_url: brand?.logo_url ?? null,
        brand_category: brand?.category ?? "",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
