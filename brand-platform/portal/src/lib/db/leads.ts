import { adminDb } from "@/lib/firebase/admin";
import { newId, nowIso } from "@/lib/db/brands";
import { COLLECTIONS, type LeadStatus, type PartnershipLeadDoc } from "@/lib/db/types";

export async function createLead(
  data: Omit<PartnershipLeadDoc, "id" | "created_at" | "updated_at" | "status" | "brand_id"> & {
    status?: LeadStatus;
    brand_id?: string | null;
  }
): Promise<PartnershipLeadDoc> {
  const id = newId();
  const ts = nowIso();
  const row: PartnershipLeadDoc = {
    id,
    company_name: data.company_name,
    email: data.email.toLowerCase(),
    message: data.message ?? null,
    status: data.status ?? "new",
    brand_id: data.brand_id ?? null,
    created_at: ts,
    updated_at: ts,
  };
  await adminDb().collection(COLLECTIONS.leads).doc(id).set(row);
  return row;
}

export async function listLeads(status?: LeadStatus, limit = 200): Promise<PartnershipLeadDoc[]> {
  let q = adminDb().collection(COLLECTIONS.leads).orderBy("created_at", "desc").limit(limit);
  if (status) {
    q = adminDb()
      .collection(COLLECTIONS.leads)
      .where("status", "==", status)
      .orderBy("created_at", "desc")
      .limit(limit);
  }
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PartnershipLeadDoc);
}

export async function updateLead(id: string, patch: Partial<PartnershipLeadDoc>) {
  await adminDb()
    .collection(COLLECTIONS.leads)
    .doc(id)
    .set({ ...patch, updated_at: nowIso() }, { merge: true });
  const snap = await adminDb().collection(COLLECTIONS.leads).doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as PartnershipLeadDoc) : null;
}

export async function markLeadsSignedUp(email: string, brandId: string) {
  const snap = await adminDb()
    .collection(COLLECTIONS.leads)
    .where("email", "==", email.toLowerCase())
    .get();
  const batch = adminDb().batch();
  const ts = nowIso();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { status: "signed_up", brand_id: brandId, updated_at: ts });
  }
  if (!snap.empty) await batch.commit();
}
