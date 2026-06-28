import { getPortalSessionUser } from "@/lib/firebase/session";
import { getBrandById, getStaffByAuthUserId } from "@/lib/db";
import type { BrandDoc } from "@/lib/db/types";

export type StaffRole = "admin" | "scanner";

export type StaffContext = {
  staffId: string;
  brandId: string;
  role: StaffRole;
  email: string;
  acceptedAt: string | null;
  authUserId: string;
};

export type BrandProfile = BrandDoc;

export async function getSessionUser() {
  return getPortalSessionUser();
}

export async function isEmailVerified() {
  if (process.env.SKIP_EMAIL_VERIFICATION === "true") return true;
  const user = await getPortalSessionUser();
  return Boolean(user?.email_verified);
}

/** Portal staff only — not CADA app users. */
export async function getStaffContext(): Promise<StaffContext | null> {
  const user = await getPortalSessionUser();
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

export async function getBrandProfile(brandId: string): Promise<BrandProfile | null> {
  return getBrandById(brandId);
}

export function requireAdmin(ctx: StaffContext) {
  if (ctx.role !== "admin") {
    throw new AuthError("Admin access required", 403);
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}
