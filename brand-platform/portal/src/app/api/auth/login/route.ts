import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isCadaAdminIdentity } from "@/lib/admin/auth";
import { handleApiError, jsonError } from "@/lib/api";
import {
  getPendingInviteStaff,
  resolvePortalStaffForLogin,
} from "@/lib/auth/resolve-portal-staff";
import { trustEmailFromPasswordAuth } from "@/lib/auth/trust-email";
import { signInWithEmailPassword } from "@/lib/firebase/auth-rest";
import { adminAuth } from "@/lib/firebase/admin";
import { setCadaAdminClaim } from "@/lib/firebase/portal-claims";
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

    await trustEmailFromPasswordAuth(signIn.localId);
    const authUser = await adminAuth().getUser(signIn.localId);
    const claims = (authUser.customClaims ?? {}) as Record<string, unknown>;
    const cadaAdmin = isCadaAdminIdentity(email, claims);

    // Keep Firebase claim in sync with CADA_ADMIN_EMAILS allowlist.
    if (cadaAdmin && claims.cadaAdmin !== true) {
      await setCadaAdminClaim(signIn.localId, true);
    }

    if (cadaAdmin) {
      // Fresh idToken after claim update so the session cookie includes cadaAdmin.
      let idToken = signIn.idToken;
      if (claims.cadaAdmin !== true) {
        try {
          const refreshed = await signInWithEmailPassword(email, password);
          idToken = refreshed.idToken;
        } catch {
          // Session still works via email allowlist on subsequent requests.
        }
      }

      const sessionCookie = await createPortalSessionCookie(idToken);
      const cookieStore = await cookies();
      cookieStore.set(PORTAL_SESSION_COOKIE, sessionCookie, portalSessionCookieOptions());

      return NextResponse.json({
        cada_admin: true,
        redirect: "/admin/challenges",
        user: {
          id: signIn.localId,
          email: signIn.email ?? email,
          email_verified: authUser.emailVerified,
        },
      });
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
      return NextResponse.json({
        needs_business_profile: true,
        redirect: "/signup/business",
        user: {
          id: signIn.localId,
          email: signIn.email ?? email,
          email_verified: true,
        },
      });
    }

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
