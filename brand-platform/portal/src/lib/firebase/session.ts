import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "@/lib/firebase/admin";

export const PORTAL_SESSION_COOKIE = "__portal_session";
const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function createPortalSessionCookie(idToken: string): Promise<string> {
  return adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
}

export function portalSessionCookieOptions(maxAgeMs = SESSION_MAX_AGE_MS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

export async function verifyPortalSessionCookie(
  sessionCookie: string | undefined
): Promise<DecodedIdToken | null> {
  if (!sessionCookie) return null;
  try {
    return await adminAuth().verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}

export async function getPortalSessionUser(): Promise<DecodedIdToken | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(PORTAL_SESSION_COOKIE)?.value;
  return verifyPortalSessionCookie(session);
}

export async function clearPortalSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(PORTAL_SESSION_COOKIE, "", { ...portalSessionCookieOptions(0), maxAge: 0 });
}
