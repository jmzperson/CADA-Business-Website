import { getPortalSessionUser } from "@/lib/firebase/session";

export type CadaAdminContext = {
  email: string;
  authUserId: string;
  via: "session" | "token";
};

function parseAdminEmails(): Set<string> {
  const raw = process.env.CADA_ADMIN_EMAILS?.trim() || "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** True when email is listed in CADA_ADMIN_EMAILS or Firebase claim cadaAdmin is set. */
export function isCadaAdminIdentity(
  email: string | null | undefined,
  claims?: Record<string, unknown> | null
): boolean {
  if (claims?.cadaAdmin === true) return true;
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return parseAdminEmails().has(normalized);
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

/** Session-based CADA platform admin (login as james@cadaapp.com, etc.). */
export async function getCadaAdminFromSession(): Promise<CadaAdminContext | null> {
  const user = await getPortalSessionUser();
  if (!user) return null;

  const email = user.email?.trim().toLowerCase() ?? null;
  if (!isCadaAdminIdentity(email, user as Record<string, unknown>)) {
    return null;
  }

  return {
    email: email ?? user.uid,
    authUserId: user.uid,
    via: "session",
  };
}

/**
 * Accept either a logged-in CADA admin session or CADA_ADMIN_TOKEN.
 * Prefer session when both are present.
 */
export async function requireCadaAdmin(
  request: Request
): Promise<CadaAdminContext | null> {
  const fromSession = await getCadaAdminFromSession();
  if (fromSession) return fromSession;

  if (verifyCadaAdminToken(request)) {
    return {
      email: "CADA_ADMIN",
      authUserId: "token",
      via: "token",
    };
  }

  return null;
}
