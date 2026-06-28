import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { signInWithEmailPassword } from "@/lib/firebase/auth-rest";
import { BRAND_CATEGORIES, handleApiError, jsonError } from "@/lib/api";
import { uniqueSlug } from "@/lib/utils";
import {
  brandSlugExists,
  createBrand,
  createBrandStaff,
  deleteBrand,
  markLeadsSignedUp,
} from "@/lib/db";
import { setPortalStaffClaims } from "@/lib/firebase/portal-claims";
import {
  createPortalSessionCookie,
  PORTAL_SESSION_COOKIE,
  portalSessionCookieOptions,
} from "@/lib/firebase/session";
import { sendNotificationEmail } from "@/lib/email/send-notification";

type RegisterBody = {
  business_name?: string;
  email?: string;
  password?: string;
  website?: string;
  category?: string;
  logo_url?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterBody;
    const businessName = body.business_name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const website = body.website?.trim() || null;
    const category = (body.category || "other") as "gym" | "food" | "wellness" | "retail" | "other";
    const logoUrl = body.logo_url?.trim() || null;

    if (!businessName || !email || !password) {
      return jsonError("business_name, email, and password are required");
    }

    if (password.length < 8) {
      return jsonError("Password must be at least 8 characters");
    }

    if (!BRAND_CATEGORIES.some((c) => c.value === category)) {
      return jsonError("Invalid category");
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const skipVerification = process.env.SKIP_EMAIL_VERIFICATION === "true";

    const slug = await uniqueSlug(businessName, brandSlugExists);

    let userRecord;
    try {
      userRecord = await adminAuth().createUser({
        email,
        password,
        emailVerified: skipVerification,
        displayName: businessName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create account";
      if (message.toLowerCase().includes("already")) {
        return jsonError("An account with this email already exists", 409);
      }
      return jsonError(message, 400);
    }

    const brand = await createBrand({
      name: businessName,
      slug,
      category,
      website,
      logo_url: logoUrl,
      offer_default_copy: null,
      primary_address: null,
      status: "active",
    });

    try {
      await createBrandStaff({
        brand_id: brand.id,
        email,
        role: "admin",
        auth_user_id: userRecord.uid,
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        invite_token: null,
        invite_expires_at: null,
      });
      await setPortalStaffClaims(userRecord.uid, { brandId: brand.id, staffRole: "admin" });
    } catch (staffErr) {
      await deleteBrand(brand.id, slug);
      await adminAuth().deleteUser(userRecord.uid);
      throw staffErr;
    }

    if (!skipVerification) {
      const verifyLink = await adminAuth().generateEmailVerificationLink(email, {
        url: `${appUrl}/verify-email`,
      });
      void sendNotificationEmail({
        to: email,
        subject: "Verify your CADA partner account",
        text: `Welcome to CADA Partners.\n\nVerify your email:\n${verifyLink}\n\n— CADA`,
      });
    }

    const signIn = await signInWithEmailPassword(email, password);
    const sessionCookie = await createPortalSessionCookie(signIn.idToken);
    const cookieStore = await cookies();
    cookieStore.set(PORTAL_SESSION_COOKIE, sessionCookie, portalSessionCookieOptions());

    await markLeadsSignedUp(email, brand.id);

    return NextResponse.json(
      {
        brand: {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          status: brand.status,
        },
        message: skipVerification
          ? "Account created."
          : "Account created. Please verify your email before using the dashboard.",
        email_verification_required: !skipVerification,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
