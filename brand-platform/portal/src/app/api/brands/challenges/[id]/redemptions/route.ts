import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { getChallengeForBrand } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { getRedemptionsLog } from "@/lib/metrics/aggregate";
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
    const allTime = searchParams.get("all_time") === "true";
    const range = allTime ? null : parseMetricsRange(searchParams);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("page_size") || 25)));

    const { rows, total } = await getRedemptionsLog(
      staff.brandId,
      allTime ? null : range!.from,
      allTime ? null : range!.to,
      page,
      pageSize,
      challengeId
    );

    return NextResponse.json({
      challenge: {
        id: challenge.id,
        title: challenge.title,
        status: challenge.status,
      },
      range: allTime ? "all_time" : range!.preset,
      from: allTime ? null : range!.from,
      to: allTime ? null : range!.to,
      label: allTime ? "All time" : range!.label,
      page,
      page_size: pageSize,
      total,
      redemptions: rows,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
