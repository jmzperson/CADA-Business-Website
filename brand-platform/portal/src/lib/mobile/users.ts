import { createAdminClient } from "@/lib/supabase/admin";

export type CadaUser = {
  id: string;
  auth_user_id: string;
  display_label: string | null;
};

export async function ensureCadaUser(authUserId: string): Promise<CadaUser> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("cada_users")
    .select("id, auth_user_id, display_label")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (existing) return existing as CadaUser;

  const { data: created, error } = await admin
    .from("cada_users")
    .insert({ auth_user_id: authUserId })
    .select("id, auth_user_id, display_label")
    .single();

  if (error || !created) {
    throw new Error(error?.message || "Failed to provision app user");
  }

  return created as CadaUser;
}

export async function getCadaUserByAuthId(authUserId: string): Promise<CadaUser | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cada_users")
    .select("id, auth_user_id, display_label")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data as CadaUser | null;
}
