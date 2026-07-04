import { getStaffByAuthUserId, getStaffByEmail, getCadaUserByAuthId, updateBrandStaff } from "@/lib/db";
import type { BrandStaffDoc } from "@/lib/db/types";
import { setPortalStaffClaims } from "@/lib/firebase/portal-claims";

export type ResolvedPortalStaff = {
  staff: BrandStaffDoc;
  linkedAuth: boolean;
};

/**
 * Resolve portal staff for login — by auth UID, or link an existing staff row by email.
 * Portal access requires accepted_at (invite completed or self-serve signup finished).
 */
export async function resolvePortalStaffForLogin(
  authUserId: string,
  email: string
): Promise<ResolvedPortalStaff | null> {
  let staff = await getStaffByAuthUserId(authUserId);
  if (staff?.accepted_at) {
    return { staff, linkedAuth: false };
  }

  const byEmail = await getStaffByEmail(email);
  if (!byEmail?.accepted_at) {
    return null;
  }

  if (byEmail.auth_user_id !== authUserId) {
    await updateBrandStaff(byEmail.id, { auth_user_id: authUserId });
    await setPortalStaffClaims(authUserId, {
      brandId: byEmail.brand_id,
      staffRole: byEmail.role,
    });
    staff = { ...byEmail, auth_user_id: authUserId };
    return { staff, linkedAuth: true };
  }

  return { staff: byEmail, linkedAuth: false };
}

/** True when Firebase Auth exists but this person is only a CADA app user, not portal staff. */
export async function isAppUserOnly(authUserId: string): Promise<boolean> {
  const [staff, appUser] = await Promise.all([
    getStaffByAuthUserId(authUserId),
    getCadaUserByAuthId(authUserId),
  ]);
  return Boolean(appUser && !staff?.accepted_at);
}

export async function getPendingInviteStaff(email: string): Promise<BrandStaffDoc | null> {
  const staff = await getStaffByEmail(email);
  if (!staff || staff.accepted_at) return null;
  return staff;
}
