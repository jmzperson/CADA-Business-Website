import { getPortalSessionUser } from "@/lib/firebase/session";
import { adminAuth } from "@/lib/firebase/admin";
import { getCadaAdminByEmail } from "@/lib/db/admins";

export type CadaAdminContext = {
  email: string;
  authUserId: string;
  via: "session" | "token";
};

const DEFAULT_CADA_ADMIN_EMAILS = "james@cadaapp.com,tannermesaric@gmail.com";

export function parseAdminEmails(): Set<string> {
  const raw = process.env.CADA_ADMIN_EMAILS?.trim() || DEFAULT_CADA_ADMIN_EMAILS;
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

function claimsAreCadaAdmin(claims?: Record<string, unknown> | null): boolean {
  return claims?.cadaAdmin === true;
}

/**
 * Source of truth for CADA platform admins (challenge approval):
 * 1. Firestore `cada_admins` row (disabled wins over env/claims)
 * 2. CADA_ADMIN_EMAILS allowlist (bootstrap)
 * 3. Live Firebase custom claim `cadaAdmin` (Admin SDK, not a stale session cookie)
 */
export async function isPlatformAdmin(params: {
  email?: string | null;
  uid?: string | null;
  claims?: Record<string, unknown> | null;
}): Promise<boolean> {
  const email = params.email?.trim().toLowerCase() || null;

  if (email) {
    const row = await getCadaAdminByEmail(email);
    if (row) return !row.disabled;
    if (parseAdminEmails().has(email)) return true;
  }

  if (claimsAreCadaAdmin(params.claims)) return true;

  if (params.uid) {
    try {
      const user = await adminAuth().getUser(params.uid);
      if (user.customClaims?.cadaAdmin === true) {
        const userEmail = user.email?.trim().toLowerCase();
        if (userEmail) {
          const row = await getCadaAdminByEmail(userEmail);
          if (row) return !row.disabled;
        }
        return true;
      }
    } catch {
      // Auth user may not exist yet.
    }
  }

  return false;
}

/** Legacy shared-secret auth for scripts and email deep links. */
export function verifyCadaAdminToken(request: Request): boolean {
  const expected = process.env.CADA_ADMIN_TOKEN;
  if (!expected) return false;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && auth.slice(7) === expected) {
    return true;
  }

  const { searchParams } = new URL(request.url);
  return searchParams.get("token") === expected;
}

/** Session-based CADA platform admin (login as a granted admin email). */
export async function getCadaAdminFromSession(): Promise<CadaAdminContext | null> {
  const user = await getPortalSessionUser();
  if (!user) return null;

  const email = user.email?.trim().toLowerCase() ?? null;
  const allowed = await isPlatformAdmin({
    email,
    uid: user.uid,
    claims: user as unknown as Record<string, unknown>,
  });
  if (!allowed) return null;

  return {
    email: email ?? user.uid,
    authUserId: user.uid,
    via: "session",
  };
}

export type CadaAdminAccess =
  | { ok: true; admin: CadaAdminContext }
  | { ok: false; status: 401 | 403 };

/**
 * Prefer logged-in CADA admin session, then CADA_ADMIN_TOKEN.
 * Returns 403 when a valid session exists but the user is not a CADA admin.
 */
export async function requireCadaAdminAccess(request: Request): Promise<CadaAdminAccess> {
  const user = await getPortalSessionUser();
  if (user) {
    const email = user.email?.trim().toLowerCase() ?? null;
    const allowed = await isPlatformAdmin({
      email,
      uid: user.uid,
      claims: user as unknown as Record<string, unknown>,
    });
    if (allowed) {
      return {
        ok: true,
        admin: {
          email: email ?? user.uid,
          authUserId: user.uid,
          via: "session",
        },
      };
    }
    return { ok: false, status: 403 };
  }

  if (verifyCadaAdminToken(request)) {
    return {
      ok: true,
      admin: {
        email: "CADA_ADMIN",
        authUserId: "token",
        via: "token",
      },
    };
  }

  return { ok: false, status: 401 };
}

/**
 * Accept either a logged-in CADA admin session or CADA_ADMIN_TOKEN.
 * Prefer session when both are present.
 */
export async function requireCadaAdmin(
  request: Request
): Promise<CadaAdminContext | null> {
  const access = await requireCadaAdminAccess(request);
  return access.ok ? access.admin : null;
}
