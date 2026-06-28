import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handleApiError, jsonError } from "@/lib/api";
import { signInWithEmailPassword } from "@/lib/firebase/auth-rest";
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

    const staff = await getStaffContextFromUid(signIn.localId, email);
    if (!staff) {
      return jsonError(
        "No brand account found. Accept your staff invite or register a new brand.",
        403
      );
    }

    const sessionCookie = await createPortalSessionCookie(signIn.idToken);
    const cookieStore = await cookies();
    cookieStore.set(PORTAL_SESSION_COOKIE, sessionCookie, portalSessionCookieOptions());

    return NextResponse.json({
      user: {
        id: signIn.localId,
        email: signIn.email ?? email,
        email_verified: staff.emailVerified,
      },
      staff: {
        id: staff.staffId,
        brand_id: staff.brandId,
        role: staff.role,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

async function getStaffContextFromUid(authUid: string, email: string) {
  const { getStaffByAuthUserId } = await import("@/lib/db");
  const { adminAuth } = await import("@/lib/firebase/admin");
  const staff = await getStaffByAuthUserId(authUid);
  if (!staff || !staff.accepted_at) return null;
  const user = await adminAuth().getUser(authUid);
  return {
    staffId: staff.id,
    brandId: staff.brand_id,
    role: staff.role,
    email: staff.email || email,
    emailVerified: user.emailVerified,
  };
}
