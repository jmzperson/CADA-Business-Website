import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, jsonError } from "@/lib/api";

export async function GET() {
  try {
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("brand_staff")
      .select("id, email, role, invited_at, accepted_at")
      .eq("brand_id", staff.brandId)
      .order("invited_at", { ascending: false });

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({
      staff: (data || []).map((row) => ({
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
