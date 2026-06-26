import { createAdminClient } from "@/lib/supabase/admin";

/** Mark issued rewards past expires_at as expired. Safe to run repeatedly. */
export async function expireQrRewards(): Promise<number> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("qr_rewards")
    .update({ status: "expired" })
    .eq("status", "issued")
    .lt("expires_at", now)
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
