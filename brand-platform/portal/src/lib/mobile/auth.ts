import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "@/lib/firebase/admin";
import { AuthError } from "@/lib/auth/session";
import { getCadaUserByAuthId } from "@/lib/db";

/** CADA iOS app users only — not portal brand staff unless they also have a cada_users profile. */
export async function getAppUserFromRequest(request: Request): Promise<DecodedIdToken | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const appUser = await getCadaUserByAuthId(decoded.uid);
    if (!appUser) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function requireAppUser(request: Request): Promise<DecodedIdToken> {
  const user = await getAppUserFromRequest(request);
  if (!user) {
    throw new AuthError("Unauthorized — valid app user Bearer token required", 401);
  }
  return user;
}
