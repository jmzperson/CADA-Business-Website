import { markLeadsSignedUp as markLeadsSignedUpDb } from "@/lib/db";

export async function markLeadsSignedUp(email: string, brandId: string) {
  await markLeadsSignedUpDb(email, brandId);
}
