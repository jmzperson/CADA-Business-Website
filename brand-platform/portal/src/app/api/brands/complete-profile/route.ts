import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { BRAND_CATEGORIES, handleApiError, jsonError } from "@/lib/api";
import { getPortalSessionUser } from "@/lib/firebase/session";
import {
  brandSlugExists,
  createBrand,
  createBrandStaff,
  getCadaUserByAuthId,
  getStaffByAuthUserId,
  markLeadsSignedUp,
} from "@/lib/db";
import { setPortalStaffClaims } from "@/lib/firebase/portal-claims";
import { uniqueSlug } from "@/lib/utils";

/** Eligibility check — page calls this on load to decide what to render. */
export async function GET() {
  try {
    const user = await getPortalSessionUser();
    if (!user) return jsonError("Unauthorized", 401);

    const existingStaff = await getStaffByAuthUserId(user.uid);
    if (existingStaff?.accepted_at) {
      return NextResponse.json({ eligible: false, reason: "already_partner", redirect: "/dashboard" });
    }

    const [authUser, appProfile] = await Promise.all([
      adminAuth().getUser(user.uid),
      getCadaUserByAuthId(user.uid),
    ]);

    return NextResponse.json({
      eligible: true,
      email: authUser.email ?? null,
      email_verified: authUser.emailVerified,
      has_app_profile: Boolean(appProfile),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

type CompleteProfileBody = {
  business_name?: string;
  category?: string;
  website?: string;
};

/** Create brand + staff for an existing Firebase Auth user (app user or orphaned signup). */
export async function POST(request: Request) {
  try {
    const user = await getPortalSessionUser();
    if (!user) return jsonError("Unauthorized", 401);

    const existingStaff = await getStaffByAuthUserId(user.uid);
    if (existingStaff?.accepted_at) {
      return NextResponse.json(
        { redirect: "/dashboard", message: "You already have a partner account." },
        { status: 409 }
      );
    }

    const body = (await request.json()) as CompleteProfileBody;
    const businessName = body.business_name?.trim();
    const category = (body.category || "other") as "gym" | "food" | "wellness" | "retail" | "other";
    const website = body.website?.trim() || null;

    if (!businessName) return jsonError("business_name is required");
    if (!BRAND_CATEGORIES.some((c) => c.value === category)) return jsonError("Invalid category");

    const [authUser, appProfile] = await Promise.all([
      adminAuth().getUser(user.uid),
      getCadaUserByAuthId(user.uid),
    ]);
    const email = authUser.email;
    if (!email) return jsonError("Account has no email address", 400);

    const slug = await uniqueSlug(businessName, brandSlugExists);

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

    await createBrandStaff({
      brand_id: brand.id,
      email,
      role: "admin",
      auth_user_id: user.uid,
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      invite_token: null,
      invite_expires_at: null,
    });

    await setPortalStaffClaims(user.uid, { brandId: brand.id, staffRole: "admin" });
    await markLeadsSignedUp(email, brand.id);

    const skipVerification =
      process.env.SKIP_EMAIL_VERIFICATION === "true" || Boolean(appProfile);
    const emailVerificationRequired = !skipVerification && !authUser.emailVerified;

    return NextResponse.json(
      {
        brand: { id: brand.id, name: brand.name, slug: brand.slug, status: brand.status },
        email_verification_required: emailVerificationRequired,
        message: emailVerificationRequired
          ? "Profile created. Verify your email to access the dashboard."
          : "Welcome to CADA Partners!",
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
