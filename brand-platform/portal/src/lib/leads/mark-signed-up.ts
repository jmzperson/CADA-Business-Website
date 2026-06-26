/** Mark partnership leads as signed_up when a brand registers with the same email. */
export async function markLeadSignedUp(
  admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  email: string,
  brandId: string
) {
  await admin
    .from("partnership_leads")
    .update({
      status: "signed_up",
      brand_id: brandId,
      updated_at: new Date().toISOString(),
    })
    .eq("email", email.toLowerCase())
    .in("status", ["new", "contacted"]);
}
