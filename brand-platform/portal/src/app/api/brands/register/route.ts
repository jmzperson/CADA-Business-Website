import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { UserRecord } from "firebase-admin/auth";
import { adminAuth } from "@/lib/firebase/admin";
import { signInWithEmailPassword } from "@/lib/firebase/auth-rest";
import { BRAND_CATEGORIES, handleApiError, jsonError } from "@/lib/api";
import {
  getPendingInviteStaff,
  isAppUserOnly,
  resolvePortalStaffForLogin,
} from "@/lib/auth/resolve-portal-staff";
import { uniqueSlug } from "@/lib/utils";
import {
  brandSlugExists,
  createBrand,
  createBrandStaff,
  deleteBrand,
  getStaffByAuthUserId,
  markLeadsSignedUp,
} from "@/lib/db";
import { setPortalStaffClaims } from "@/lib/firebase/portal-claims";
import {
  createPortalSessionCookie,
  PORTAL_SESSION_COOKIE,
  portalSessionCookieOptions,
} from "@/lib/firebase/session";
import { trustEmailFromPasswordAuth } from "@/lib/auth/trust-email";

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

    const slug = await uniqueSlug(businessName, brandSlugExists);

    let userRecord: UserRecord;
    try {
      userRecord = await adminAuth().createUser({
        email,
        password,
        emailVerified: true,
        displayName: businessName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create account";
      if (!message.toLowerCase().includes("already")) {
        return jsonError(message, 400);
      }

      const resume = await resumeExistingAuthRegistration({
        email,
        password,
        businessName,
        category,
        website,
        logoUrl,
        slug,
      });
      if (resume) return resume;

      return jsonError(
        "An account with this email already exists. Sign in with your password instead.",
        409
      );
    }

    return finishRegistration({
      userRecord,
      email,
      password,
      businessName,
      category,
      website,
      logoUrl,
      slug,
      isNewAuthUser: true,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

type FinishParams = {
  userRecord: UserRecord;
  email: string;
  password: string;
  businessName: string;
  category: "gym" | "food" | "wellness" | "retail" | "other";
  website: string | null;
  logoUrl: string | null;
  slug: string;
  isNewAuthUser: boolean;
};

async function finishRegistration(params: FinishParams) {
  const {
    userRecord,
    email,
    password,
    businessName,
    category,
    website,
    logoUrl,
    slug,
    isNewAuthUser,
  } = params;

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
    if (isNewAuthUser) {
      await adminAuth().deleteUser(userRecord.uid);
    }
    throw staffErr;
  }

  await trustEmailFromPasswordAuth(userRecord.uid);

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
      message: "Account created.",
      redirect: "/dashboard",
    },
    { status: 201 }
  );
}

/** Auth user exists — link staff, resume incomplete signup, or tell client to sign in. */
async function resumeExistingAuthRegistration(params: {
  email: string;
  password: string;
  businessName: string;
  category: "gym" | "food" | "wellness" | "retail" | "other";
  website: string | null;
  logoUrl: string | null;
  slug: string;
}): Promise<NextResponse | null> {
  const { email, password, slug } = params;

  let signIn;
  try {
    signIn = await signInWithEmailPassword(email, password);
  } catch {
    return jsonError(
      "An account with this email already exists. Sign in with your password, or use Forgot password.",
      409
    );
  }

  const existingStaff = await getStaffByAuthUserId(signIn.localId);
  if (existingStaff?.accepted_at) {
    return jsonError(
      "An account with this email already exists. Sign in with your password instead.",
      409
    );
  }

  const resolved = await resolvePortalStaffForLogin(signIn.localId, email);
  if (resolved) {
    return jsonError(
      "An account with this email already exists. Sign in with your password instead.",
      409
    );
  }

  if (await getPendingInviteStaff(email)) {
    return jsonError(
      "This email has a pending partner invite. Open the invite link from your email to finish setup.",
      409
    );
  }

  if (await isAppUserOnly(signIn.localId)) {
    await trustEmailFromPasswordAuth(signIn.localId);
    const sessionCookie = await createPortalSessionCookie(signIn.idToken);
    const cookieStore = await cookies();
    cookieStore.set(PORTAL_SESSION_COOKIE, sessionCookie, portalSessionCookieOptions());
    return NextResponse.json({
      needs_business_profile: true,
      redirect: "/signup/business",
      message: "Sign in successful. Complete your business profile next.",
    });
  }

  const userRecord = await adminAuth().getUser(signIn.localId);
  await adminAuth().updateUser(userRecord.uid, {
    password,
    displayName: params.businessName,
    emailVerified: true,
  });

  return finishRegistration({
    userRecord: await adminAuth().getUser(userRecord.uid),
    email,
    password,
    businessName: params.businessName,
    category: params.category,
    website: params.website,
    logoUrl: params.logoUrl,
    slug,
    isNewAuthUser: false,
  });
}
