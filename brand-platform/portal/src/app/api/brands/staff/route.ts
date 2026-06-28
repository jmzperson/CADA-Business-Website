import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { listStaffByBrand } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";

export async function GET() {
  try {
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);

    const data = await listStaffByBrand(staff.brandId);
    data.sort((a, b) => b.invited_at.localeCompare(a.invited_at));

    return NextResponse.json({
      staff: data.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        status: row.accepted_at ? "active" : "pending",
        invited_at: row.invited_at,
        accepted_at: row.accepted_at,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
