import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handleApiError, jsonError } from "@/lib/api";
import {
  getPendingInviteStaff,
  isAppUserOnly,
  resolvePortalStaffForLogin,
} from "@/lib/auth/resolve-portal-staff";
import { signInWithEmailPassword } from "@/lib/firebase/auth-rest";
import { adminAuth } from "@/lib/firebase/admin";
import {
  createPortalSessionCookie,
  PORTAL_SESSION_COOKIE,
  portalSessionCookieOptions,
} from "@/lib/firebase/session";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return jsonError("email and password are required");
    }

    let signIn;
    try {
      signIn = await signInWithEmailPassword(email, password);
    } catch {
      return jsonError("Invalid email or password", 401);
    }

    const resolved = await resolvePortalStaffForLogin(signIn.localId, email);
    if (!resolved) {
      const pendingInvite = await getPendingInviteStaff(email);
      if (pendingInvite) {
        return jsonError(
          "Your partner invite is not complete yet. Open the invite link from your email to set your password.",
          403
        );
      }

      // Authenticated but no partner account and no pending invite —
      // whether they're a CADA app user or just a raw Firebase Auth account,
      // send them to complete their business profile.
      const sessionCookie = await createPortalSessionCookie(signIn.idToken);
      const cookieStore = await cookies();
      cookieStore.set(PORTAL_SESSION_COOKIE, sessionCookie, portalSessionCookieOptions());
      const authUser = await adminAuth().getUser(signIn.localId);
      return NextResponse.json({
        needs_business_profile: true,
        redirect: "/signup/business",
        user: {
          id: signIn.localId,
          email: signIn.email ?? email,
          email_verified: authUser.emailVerified,
        },
      });
    }

    const authUser = await adminAuth().getUser(signIn.localId);
    const sessionCookie = await createPortalSessionCookie(signIn.idToken);
    const cookieStore = await cookies();
    cookieStore.set(PORTAL_SESSION_COOKIE, sessionCookie, portalSessionCookieOptions());

    return NextResponse.json({
      user: {
        id: signIn.localId,
        email: signIn.email ?? email,
        email_verified: authUser.emailVerified,
      },
      staff: {
        id: resolved.staff.id,
        brand_id: resolved.staff.brand_id,
        role: resolved.staff.role,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
