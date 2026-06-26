import { NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { getStaffContextFromRequest } from "@/lib/auth/staff-request";
import {
  parseTokenFromScan,
  redeemErrorMessage,
  redeemQrToken,
} from "@/lib/mobile/redeem";
import { checkRateLimit } from "@/lib/mobile/rate-limit";

type Body = {
  token?: string;
  location_id?: string;
};

export async function postRedeem(request: Request) {
  try {
    const staff = await getStaffContextFromRequest(request);
    if (!staff) {
      return NextResponse.json(
        { error: "unauthorized", message: redeemErrorMessage("unauthorized") },
        { status: 401 }
      );
    }

    if (staff.role !== "admin" && staff.role !== "scanner") {
      return NextResponse.json(
        { error: "unauthorized", message: "Scanner or admin access required" },
        { status: 403 }
      );
    }

    const rate = checkRateLimit(`redeem:${staff.staffId}`, 60, 60_000);
    if (!rate.allowed) {
      return jsonError("Rate limit exceeded", 429);
    }

    const body = (await request.json()) as Body;
    const raw = body.token?.trim();
    if (!raw) return jsonError("token is required");

    const token = parseTokenFromScan(raw);
    if (!token) return jsonError("token is required");

    const result = await redeemQrToken({
      rawToken: token,
      brandId: staff.brandId,
      staffId: staff.staffId,
      locationId: body.location_id,
      metadata: {
        user_agent: request.headers.get("user-agent") ?? undefined,
        scan_source: request.headers.get("x-scan-source") ?? "api",
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          message: result.message,
          redeemed_at: result.redeemed_at,
        },
        { status: result.httpStatus }
      );
    }

    return NextResponse.json({
      status: result.status,
      message: result.message,
      redeemed_at: result.redeemed_at,
      challenge_title: result.challenge_title,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
