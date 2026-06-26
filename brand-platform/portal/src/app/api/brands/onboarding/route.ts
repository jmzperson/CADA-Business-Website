import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api";
import { getBrandOnboarding } from "@/lib/onboarding";

export async function GET() {
  try {
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);

    const onboarding = await getBrandOnboarding(staff.brandId);
    return NextResponse.json(onboarding);
  } catch (err) {
    return handleApiError(err);
  }
}
