import { ensureCadaUser as ensureCadaUserDb } from "@/lib/db";

/** Ensure a CADA app user row exists for this Firebase auth uid (not portal staff). */
export async function ensureCadaUser(authUserId: string) {
  return ensureCadaUserDb(authUserId);
}
