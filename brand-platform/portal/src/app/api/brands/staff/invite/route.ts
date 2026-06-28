import { NextResponse } from "next/server";
import { getStaffContext, requireAdmin } from "@/lib/auth/session";
import {
  createBrandStaff,
  getStaffByBrandEmail,
  updateBrandStaff,
} from "@/lib/db";
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

    const existing = await getStaffByBrandEmail(staff.brandId, email);

    if (existing?.accepted_at) {
      return jsonError("This email is already on your team", 409);
    }

    const inviteToken = generateInviteToken();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/invite?token=${inviteToken}`;
    const invitedAt = new Date().toISOString();

    if (existing) {
      const updated = await updateBrandStaff(existing.id, {
        role,
        invite_token: inviteToken,
        invite_expires_at: inviteExpiresAt,
        invited_at: invitedAt,
      });
      if (!updated) return jsonError("Failed to update invite", 500);
    } else {
      await createBrandStaff({
        brand_id: staff.brandId,
        email,
        role,
        auth_user_id: null,
        invite_token: inviteToken,
        invite_expires_at: inviteExpiresAt,
        invited_at: invitedAt,
        accepted_at: null,
      });
    }

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
