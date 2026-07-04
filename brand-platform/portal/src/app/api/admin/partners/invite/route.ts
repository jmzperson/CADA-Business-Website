import { NextResponse } from "next/server";
import { verifyCadaAdminToken } from "@/lib/admin/auth";
import {
  BRAND_CATEGORIES,
  handleApiError,
  jsonError,
  type BrandCategory,
} from "@/lib/api";
import {
  brandSlugExists,
  createBrand,
  createBrandStaff,
  getBrandById,
  getStaffByEmail,
  updateBrandStaff,
} from "@/lib/db";
import { partnerInviteEmail } from "@/lib/email/partner-invite";
import { sendNotificationEmail } from "@/lib/email/send-notification";
import { markLeadsSignedUp } from "@/lib/leads/mark-signed-up";
import { generateInviteToken, uniqueSlug } from "@/lib/utils";

type InviteBody = {
  business_name?: string;
  email?: string;
  category?: string;
  website?: string;
  lead_id?: string;
};

/** CADA admin: create a brand + send invite email (invite-only onboarding). */
export async function POST(request: Request) {
  try {
    if (!verifyCadaAdminToken(request)) {
      return jsonError("Unauthorized", 401);
    }

    const body = (await request.json()) as InviteBody;
    const businessName = body.business_name?.trim();
    const email = body.email?.trim().toLowerCase();
    const website = body.website?.trim() || null;
    const category = (body.category || "other") as BrandCategory;

    if (!businessName || !email) {
      return jsonError("business_name and email are required");
    }

    if (!BRAND_CATEGORIES.some((c) => c.value === category)) {
      return jsonError("Invalid category");
    }

    const existingStaff = await getStaffByEmail(email);
    if (existingStaff?.accepted_at) {
      return jsonError("This email already has an active partner account", 409);
    }

    const slug = await uniqueSlug(businessName, brandSlugExists);
    const inviteToken = generateInviteToken();
    const inviteExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/invite?token=${inviteToken}`;
    const invitedAt = new Date().toISOString();

    let brandId: string;
    let staffId: string;
    let brandName = businessName;

    if (existingStaff && !existingStaff.accepted_at) {
      brandId = existingStaff.brand_id;
      staffId = existingStaff.id;
      const brand = await getBrandById(brandId);
      if (brand) brandName = brand.name;
      await updateBrandStaff(existingStaff.id, {
        role: "admin",
        invite_token: inviteToken,
        invite_expires_at: inviteExpiresAt,
        invited_at: invitedAt,
      });
    } else {
      const brand = await createBrand({
        name: businessName,
        slug,
        category,
        website,
        logo_url: null,
        offer_default_copy: null,
        primary_address: null,
        status: "active",
      });
      brandId = brand.id;
      brandName = brand.name;

      const staff = await createBrandStaff({
        brand_id: brand.id,
        email,
        role: "admin",
        auth_user_id: null,
        invite_token: inviteToken,
        invite_expires_at: inviteExpiresAt,
        invited_at: invitedAt,
        accepted_at: null,
      });
      staffId = staff.id;
    }

    const emailContent = partnerInviteEmail({
      brandName,
      inviteUrl,
      expiresAt: inviteExpiresAt,
    });

    const sent = await sendNotificationEmail({
      to: email,
      subject: emailContent.subject,
      text: emailContent.text,
    });

    if (body.lead_id) {
      await markLeadsSignedUp(email, brandId);
    }

    return NextResponse.json(
      {
        brand_id: brandId,
        staff_id: staffId,
        email,
        invite_url: inviteUrl,
        expires_at: inviteExpiresAt,
        email_sent: sent.ok,
        email_error: sent.ok ? undefined : sent.error,
        message: sent.ok
          ? "Partner invited. They will receive an email with a link to create their account."
          : "Invite created but email failed to send. Share the invite_url manually.",
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
