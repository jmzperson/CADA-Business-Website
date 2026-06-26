import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api";
import { getBrandMetrics } from "@/lib/metrics/aggregate";
import { parseMetricsRange } from "@/lib/metrics/range";

export async function GET(request: Request) {
  try {
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const range = parseMetricsRange(searchParams);
    const metrics = await getBrandMetrics(staff.brandId, range.from, range.to);

    return NextResponse.json({
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
