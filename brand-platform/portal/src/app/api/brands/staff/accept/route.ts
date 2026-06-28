import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { signInWithEmailPassword } from "@/lib/firebase/auth-rest";
import {
  createPortalSessionCookie,
  PORTAL_SESSION_COOKIE,
  portalSessionCookieOptions,
} from "@/lib/firebase/session";
import { setPortalStaffClaims } from "@/lib/firebase/portal-claims";
import {
  getBrandById,
  getStaffByInviteToken,
  updateBrandStaff,
} from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";

type AcceptBody = {
  token?: string;
  password?: string;
  name?: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) return jsonError("token is required");

    const invite = await getStaffByInviteToken(token);
    if (!invite) return jsonError("Invalid invite", 404);
    if (invite.accepted_at) return jsonError("Invite already accepted", 409);
    if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
      return jsonError("Invite has expired", 410);
    }

    const brand = await getBrandById(invite.brand_id);

    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      brand_name: brand?.name ?? "Brand",
      expires_at: invite.invite_expires_at,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AcceptBody;
    const token = body.token?.trim();
    const password = body.password;

    if (!token || !password) {
      return jsonError("token and password are required");
    }

    if (password.length < 8) {
      return jsonError("Password must be at least 8 characters");
    }

    const invite = await getStaffByInviteToken(token);
    if (!invite) return jsonError("Invalid invite", 404);
    if (invite.accepted_at) return jsonError("Invite already accepted", 409);
    if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
      return jsonError("Invite has expired", 410);
    }

    const email = invite.email;
    let userId: string;

    try {
      const userRecord = await adminAuth().createUser({
        email,
        password,
        emailVerified: true,
      });
      userId = userRecord.uid;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const alreadyRegistered =
        message.toLowerCase().includes("already") ||
        message.toLowerCase().includes("exists");

      if (!alreadyRegistered) {
        return jsonError(message || "Failed to create account", 500);
      }

      try {
        const existingUser = await adminAuth().getUserByEmail(email);
        userId = existingUser.uid;
        await adminAuth().updateUser(userId, { password });
      } catch {
        return jsonError("Account exists but could not be linked. Contact support.", 500);
      }
    }

    const updated = await updateBrandStaff(invite.id, {
      auth_user_id: userId,
      accepted_at: new Date().toISOString(),
      invite_token: null,
      invite_expires_at: null,
    });

    if (!updated) return jsonError("Failed to accept invite", 500);

    await setPortalStaffClaims(userId, {
      brandId: invite.brand_id,
      staffRole: invite.role,
    });

    const signIn = await signInWithEmailPassword(email, password);
    const sessionCookie = await createPortalSessionCookie(signIn.idToken);
    const cookieStore = await cookies();
    cookieStore.set(PORTAL_SESSION_COOKIE, sessionCookie, portalSessionCookieOptions());

    return NextResponse.json({
      message: "Invite accepted. Welcome to the team.",
      staff: {
        id: invite.id,
        brand_id: invite.brand_id,
        role: invite.role,
        email,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
