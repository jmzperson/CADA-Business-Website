import { getStaffContext } from "@/lib/auth/session";
import { getAppUserFromRequest } from "@/lib/mobile/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffContext } from "@/lib/auth/session";

/** Brand staff from portal cookie session or Bearer JWT. */
export async function getStaffContextFromRequest(
  request: Request
): Promise<StaffContext | null> {
  const fromCookie = await getStaffContext();
  if (fromCookie) return fromCookie;

  const user = await getAppUserFromRequest(request);
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("brand_staff")
    .select("id, brand_id, role, email, accepted_at")
    .eq("auth_user_id", user.id)
    .not("accepted_at", "is", null)
    .maybeSingle();

  if (!data) return null;

  return {
    staffId: data.id,
    brandId: data.brand_id,
    role: data.role as StaffContext["role"],
    email: data.email,
    acceptedAt: data.accepted_at,
  };
}
