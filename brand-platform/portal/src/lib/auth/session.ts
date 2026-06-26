import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type StaffRole = "admin" | "scanner";

export type StaffContext = {
  staffId: string;
  brandId: string;
  role: StaffRole;
  email: string;
  acceptedAt: string | null;
};

export type BrandProfile = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  category: string;
  website: string | null;
  offer_default_copy: string | null;
  primary_address: string | null;
  status: string;
  created_at: string;
};

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function isEmailVerified() {
  if (process.env.SKIP_EMAIL_VERIFICATION === "true") return true;
  const user = await getSessionUser();
  return Boolean(user?.email_confirmed_at);
}

export async function getStaffContext(): Promise<StaffContext | null> {
  const user = await getSessionUser();
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
    role: data.role as StaffRole,
    email: data.email,
    acceptedAt: data.accepted_at,
  };
}

export async function getBrandProfile(brandId: string): Promise<BrandProfile | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("brands").select("*").eq("id", brandId).maybeSingle();
  return data as BrandProfile | null;
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
