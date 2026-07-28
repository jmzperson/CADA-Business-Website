import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "@/lib/firebase/admin";
import { AuthError } from "@/lib/errors";
import type { CadaUserDoc } from "@/lib/db/types";
import { ensureCadaUser } from "@/lib/mobile/users";

export type AuthenticatedAppUser = {
  token: DecodedIdToken;
  cadaUser: CadaUserDoc;
};

/**
 * CADA iOS app users — verifies Firebase ID token, then get-or-creates
 * cada_users / cada_users_by_auth (auto-provision on first authenticated call).
 */
export async function getAppUserFromRequest(
  request: Request
): Promise<AuthenticatedAppUser | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn("[requireAppUser] reject: missing_or_invalid_authorization_header");
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    console.warn("[requireAppUser] reject: empty_bearer_token");
    return null;
  }

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    // Idempotent get-or-create — only writes when cada_users_by_auth/{uid} is missing.
    const cadaUser = await ensureCadaUser(decoded.uid);
    return { token: decoded, cadaUser };
  } catch (err) {
    console.warn("[requireAppUser] reject: verifyIdToken_or_lookup_threw", {
      message: err instanceof Error ? err.message : String(err),
      name: err instanceof Error ? err.name : undefined,
    });
    return null;
  }
}

export async function requireAppUser(request: Request): Promise<AuthenticatedAppUser> {
  const user = await getAppUserFromRequest(request);
  if (!user) {
    throw new AuthError("Unauthorized — valid app user Bearer token required", 401);
  }
  return user;
}
