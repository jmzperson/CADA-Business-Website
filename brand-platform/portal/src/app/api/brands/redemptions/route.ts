import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api";
import { getRedemptionsLog } from "@/lib/metrics/aggregate";
import { parseMetricsRange } from "@/lib/metrics/range";

export async function GET(request: Request) {
  try {
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const range = parseMetricsRange(searchParams);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("page_size") || 25)));

    const { rows, total } = await getRedemptionsLog(
      staff.brandId,
      range.from,
      range.to,
      page,
      pageSize
    );

    return NextResponse.json({
      range: range.preset,
      from: range.from,
      to: range.to,
      label: range.label,
      page,
      page_size: pageSize,
      total,
      redemptions: rows,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
