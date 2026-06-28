import { randomUUID } from "crypto";
import { FieldPath, type Query } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, type BrandDoc, type BrandStaffDoc } from "@/lib/db/types";

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function batchGetByIds<T extends { id: string }>(
  collection: string,
  ids: string[]
): Promise<T[]> {
  if (ids.length === 0) return [];
  const db = adminDb();
  const unique = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 30) {
    chunks.push(unique.slice(i, i + 30));
  }
  const results: T[] = [];
  for (const chunk of chunks) {
    const snap = await db
      .collection(collection)
      .where(FieldPath.documentId(), "in", chunk)
      .get();
    for (const doc of snap.docs) {
      results.push({ id: doc.id, ...doc.data() } as T);
    }
  }
  return results;
}

// --- Brands ---

export async function brandSlugExists(slug: string): Promise<boolean> {
  const db = adminDb();
  const snap = await db.collection(COLLECTIONS.brandsBySlug).doc(slug).get();
  return snap.exists;
}

export async function getBrandById(id: string): Promise<BrandDoc | null> {
  const snap = await adminDb().collection(COLLECTIONS.brands).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as BrandDoc;
}

export async function createBrand(
  data: Omit<BrandDoc, "id" | "created_at" | "updated_at">
): Promise<BrandDoc> {
  const db = adminDb();
  const id = newId();
  const ts = nowIso();
  const brand: BrandDoc = { id, ...data, created_at: ts, updated_at: ts };
  const batch = db.batch();
  batch.set(db.collection(COLLECTIONS.brands).doc(id), brand);
  batch.set(db.collection(COLLECTIONS.brandsBySlug).doc(data.slug), { brand_id: id });
  await batch.commit();
  return brand;
}

export async function updateBrand(id: string, patch: Partial<BrandDoc>): Promise<BrandDoc | null> {
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.brands).doc(id);
  const updated = { ...patch, updated_at: nowIso() };
  await ref.set(updated, { merge: true });
  return getBrandById(id);
}

export async function deleteBrand(id: string, slug: string) {
  const db = adminDb();
  const batch = db.batch();
  batch.delete(db.collection(COLLECTIONS.brands).doc(id));
  batch.delete(db.collection(COLLECTIONS.brandsBySlug).doc(slug));
  await batch.commit();
}

// --- Brand staff (portal users — separate from app cada_users) ---

export async function getStaffByAuthUserId(authUserId: string): Promise<BrandStaffDoc | null> {
  const db = adminDb();
  const index = await db.collection(COLLECTIONS.staffByAuth).doc(authUserId).get();
  if (!index.exists) return null;
  const staffId = index.data()?.staff_id as string;
  const snap = await db.collection(COLLECTIONS.brandStaff).doc(staffId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as BrandStaffDoc;
}

export async function getStaffById(id: string): Promise<BrandStaffDoc | null> {
  const snap = await adminDb().collection(COLLECTIONS.brandStaff).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as BrandStaffDoc;
}

export async function getStaffByInviteToken(token: string): Promise<BrandStaffDoc | null> {
  const db = adminDb();
  const index = await db.collection(COLLECTIONS.staffByInvite).doc(token).get();
  if (!index.exists) return null;
  const staffId = index.data()?.staff_id as string;
  return getStaffById(staffId);
}

export async function listStaffByBrand(brandId: string): Promise<BrandStaffDoc[]> {
  const snap = await adminDb()
    .collection(COLLECTIONS.brandStaff)
    .where("brand_id", "==", brandId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BrandStaffDoc);
}

export async function createBrandStaff(
  data: Omit<BrandStaffDoc, "id" | "created_at">
): Promise<BrandStaffDoc> {
  const db = adminDb();
  const id = newId();
  const staff: BrandStaffDoc = { id, ...data, created_at: nowIso() };
  const batch = db.batch();
  batch.set(db.collection(COLLECTIONS.brandStaff).doc(id), staff);
  if (data.auth_user_id) {
    batch.set(db.collection(COLLECTIONS.staffByAuth).doc(data.auth_user_id), { staff_id: id });
  }
  if (data.invite_token) {
    batch.set(db.collection(COLLECTIONS.staffByInvite).doc(data.invite_token), { staff_id: id });
  }
  await batch.commit();
  return staff;
}

export async function updateBrandStaff(id: string, patch: Partial<BrandStaffDoc>) {
  const db = adminDb();
  const existing = await getStaffById(id);
  if (!existing) return null;

  const batch = db.batch();
  const ref = db.collection(COLLECTIONS.brandStaff).doc(id);
  batch.set(ref, patch, { merge: true });

  if (patch.auth_user_id && patch.auth_user_id !== existing.auth_user_id) {
    if (existing.auth_user_id) {
      batch.delete(db.collection(COLLECTIONS.staffByAuth).doc(existing.auth_user_id));
    }
    batch.set(db.collection(COLLECTIONS.staffByAuth).doc(patch.auth_user_id), { staff_id: id });
  }
  if (existing.invite_token && (patch.invite_token === null || patch.invite_token !== existing.invite_token)) {
    batch.delete(db.collection(COLLECTIONS.staffByInvite).doc(existing.invite_token));
  }
  if (patch.invite_token && patch.invite_token !== existing.invite_token) {
    batch.set(db.collection(COLLECTIONS.staffByInvite).doc(patch.invite_token), { staff_id: id });
  }

  await batch.commit();
  return getStaffById(id);
}

export async function staffEmailExistsOnBrand(brandId: string, email: string): Promise<boolean> {
  const staff = await getStaffByBrandEmail(brandId, email);
  return staff !== null;
}

export async function getStaffByBrandEmail(
  brandId: string,
  email: string
): Promise<BrandStaffDoc | null> {
  const snap = await adminDb()
    .collection(COLLECTIONS.brandStaff)
    .where("brand_id", "==", brandId)
    .where("email", "==", email.toLowerCase())
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as BrandStaffDoc;
}

export function applyRangeFilter<T>(
  q: Query,
  field: string,
  from: string | null,
  to: string | null
): Query {
  let query = q;
  if (from) query = query.where(field, ">=", from);
  if (to) query = query.where(field, "<=", to);
  return query;
}
