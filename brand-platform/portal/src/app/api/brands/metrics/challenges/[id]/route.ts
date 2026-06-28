import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { getChallengeForBrand } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { getBrandMetrics } from "@/lib/metrics/aggregate";
import { parseMetricsRange } from "@/lib/metrics/range";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);

    const { id: challengeId } = await params;
    const challenge = await getChallengeForBrand(challengeId, staff.brandId);
    if (!challenge) return jsonError("Challenge not found", 404);

    const { searchParams } = new URL(request.url);
    const range = parseMetricsRange(searchParams);
    const metrics = await getBrandMetrics(staff.brandId, range.from, range.to, challengeId);

    return NextResponse.json({
      challenge: {
        id: challenge.id,
        title: challenge.title,
        status: challenge.status,
      },
      range: range.preset,
      from: range.from,
      to: range.to,
      label: range.label,
      ...metrics,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
