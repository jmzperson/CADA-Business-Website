import { isPlatformAdmin } from "@/lib/admin/auth";
import { getStaffByAuthUserId } from "@/lib/db";
import { getPortalSessionUser } from "@/lib/firebase/session";

/** Where an authenticated user should land (login home, middleware cannot call this). */
export async function resolvePortalEntryPath(): Promise<string> {
  const user = await getPortalSessionUser();
  if (!user) return "/login";

  if (
    await isPlatformAdmin({
      email: user.email,
      uid: user.uid,
      claims: user as unknown as Record<string, unknown>,
    })
  ) {
    return "/admin/challenges";
  }

  const staff = await getStaffByAuthUserId(user.uid);
  if (!staff?.accepted_at) return "/signup/business";

  return "/dashboard";
}
