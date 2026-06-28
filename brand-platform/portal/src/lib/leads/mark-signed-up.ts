import { markLeadsSignedUp as markLeadsSignedUpDb } from "@/lib/db";

export async function markLeadSignedUp(_admin: unknown, email: string, brandId: string) {
  await markLeadsSignedUpDb(email, brandId);
}
