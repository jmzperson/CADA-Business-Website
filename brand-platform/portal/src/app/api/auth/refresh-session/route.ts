import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handleApiError, jsonError } from "@/lib/api";
import { getPortalSessionUser } from "@/lib/firebase/session";
import { adminAuth } from "@/lib/firebase/admin";
import {
  createPortalSessionCookie,
  PORTAL_SESSION_COOKIE,
  portalSessionCookieOptions,
} from "@/lib/firebase/session";

/**
 * Exchange a fresh Firebase ID token for a new session cookie.
 * Called by the verify-email page after the user confirms their email,
 * so the new cookie carries email_verified: true.
 */
export async function POST(request: Request) {
  try {
    const existing = await getPortalSessionUser();
    if (!existing) return jsonError("Unauthorized", 401);

    const body = (await request.json()) as { idToken?: string };
    if (!body.idToken) return jsonError("idToken is required");

    const decoded = await adminAuth().verifyIdToken(body.idToken, true);
    if (decoded.uid !== existing.uid) return jsonError("Token mismatch", 403);

    const sessionCookie = await createPortalSessionCookie(body.idToken);
    const cookieStore = await cookies();
    cookieStore.set(PORTAL_SESSION_COOKIE, sessionCookie, portalSessionCookieOptions());

    return NextResponse.json({ ok: true, email_verified: Boolean(decoded.email_verified) });
  } catch (err) {
    return handleApiError(err);
  }
}
