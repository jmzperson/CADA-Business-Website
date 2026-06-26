import { NextResponse } from "next/server";
import { getStaffContext, requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, jsonError } from "@/lib/api";
import { generateInviteToken } from "@/lib/utils";

type InviteBody = {
  email?: string;
  role?: "admin" | "scanner";
};

export async function POST(request: Request) {
  try {
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);
    requireAdmin(staff);

    const body = (await request.json()) as InviteBody;
    const email = body.email?.trim().toLowerCase();
    const role = body.role || "scanner";

    if (!email) return jsonError("email is required");
    if (role !== "admin" && role !== "scanner") return jsonError("role must be admin or scanner");

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("brand_staff")
      .select("id, accepted_at")
      .eq("brand_id", staff.brandId)
      .eq("email", email)
      .maybeSingle();

    if (existing?.accepted_at) {
      return jsonError("This email is already on your team", 409);
    }

    const inviteToken = generateInviteToken();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/invite?token=${inviteToken}`;

    if (existing) {
      const { error } = await admin
        .from("brand_staff")
        .update({
          role,
          invite_token: inviteToken,
          invite_expires_at: inviteExpiresAt,
          invited_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) return jsonError(error.message, 500);
    } else {
      const { error } = await admin.from("brand_staff").insert({
        brand_id: staff.brandId,
        email,
        role,
        invite_token: inviteToken,
        invite_expires_at: inviteExpiresAt,
        invited_at: new Date().toISOString(),
      });

      if (error) return jsonError(error.message, 500);
    }

    // MVP: return invite URL for dev; production sends email via Supabase/Resend
    return NextResponse.json(
      {
        email,
        role,
        invite_url: inviteUrl,
        expires_at: inviteExpiresAt,
        message: "Invite created. Share the invite link with your team member.",
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
