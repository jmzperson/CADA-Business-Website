import { getStaffContext } from "@/lib/auth/session";
import { getStaffByAuthUserId } from "@/lib/db";
import { getAppUserFromRequest } from "@/lib/mobile/auth";
import type { StaffContext } from "@/lib/auth/session";

/** Brand staff from portal cookie session or Bearer JWT. */
export async function getStaffContextFromRequest(
  request: Request
): Promise<StaffContext | null> {
  const fromCookie = await getStaffContext();
  if (fromCookie) return fromCookie;

  const user = await getAppUserFromRequest(request);
  if (!user) return null;

  const staff = await getStaffByAuthUserId(user.uid);
  if (!staff || !staff.accepted_at) return null;

  return {
    staffId: staff.id,
    brandId: staff.brand_id,
    role: staff.role,
    email: staff.email,
    acceptedAt: staff.accepted_at,
    authUserId: user.uid,
  };
}
