import { adminDb } from "@/lib/firebase/admin";
import { batchGetByIds, newId, nowIso } from "@/lib/db/brands";
import { COLLECTIONS, type ChallengeDoc, type ChallengeStatus } from "@/lib/db/types";

export async function getChallengeById(id: string): Promise<ChallengeDoc | null> {
  const snap = await adminDb().collection(COLLECTIONS.challenges).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as ChallengeDoc;
}

export async function getChallengeForBrand(
  challengeId: string,
  brandId: string
): Promise<ChallengeDoc | null> {
  const c = await getChallengeById(challengeId);
  if (!c || c.brand_id !== brandId) return null;
  return c;
}

export async function listChallengesByBrand(brandId: string): Promise<ChallengeDoc[]> {
  const snap = await adminDb()
    .collection(COLLECTIONS.challenges)
    .where("brand_id", "==", brandId)
    .orderBy("created_at", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChallengeDoc);
}

export async function listChallengesByStatus(
  status: ChallengeStatus,
  limit = 200
): Promise<ChallengeDoc[]> {
  const snap = await adminDb()
    .collection(COLLECTIONS.challenges)
    .where("status", "==", status)
    .orderBy("submitted_at", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChallengeDoc);
}

export async function listActiveChallengesStartedBefore(iso: string): Promise<ChallengeDoc[]> {
  const snap = await adminDb()
    .collection(COLLECTIONS.challenges)
    .where("status", "==", "active")
    .where("starts_at", "<=", iso)
    .orderBy("starts_at", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChallengeDoc);
}

export async function listChallengesByBrandAndStatus(
  brandId: string,
  statuses: ChallengeStatus[]
): Promise<ChallengeDoc[]> {
  const all = await listChallengesByBrand(brandId);
  return all.filter((c) => statuses.includes(c.status));
}

export async function createChallenge(
  data: Omit<ChallengeDoc, "id" | "created_at" | "updated_at">
): Promise<ChallengeDoc> {
  const db = adminDb();
  const id = newId();
  const ts = nowIso();
  const row: ChallengeDoc = { id, ...data, created_at: ts, updated_at: ts };
  await db.collection(COLLECTIONS.challenges).doc(id).set(row);
  return row;
}

export async function updateChallenge(
  id: string,
  patch: Partial<ChallengeDoc>
): Promise<ChallengeDoc | null> {
  const db = adminDb();
  await db
    .collection(COLLECTIONS.challenges)
    .doc(id)
    .set({ ...patch, updated_at: nowIso() }, { merge: true });
  return getChallengeById(id);
}

export async function deleteChallenge(id: string) {
  await adminDb().collection(COLLECTIONS.challenges).doc(id).delete();
}

export async function expireEndedChallenges(): Promise<number> {
  const db = adminDb();
  const now = nowIso();
  const snap = await db
    .collection(COLLECTIONS.challenges)
    .where("status", "==", "active")
    .get();
  let count = 0;
  const batch = db.batch();
  for (const doc of snap.docs) {
    const endsAt = doc.data().ends_at as string | null;
    if (endsAt && new Date(endsAt) <= new Date(now)) {
      batch.update(doc.ref, { status: "ended", updated_at: now });
      count += 1;
    }
  }
  if (count > 0) await batch.commit();
  return count;
}

export async function getChallengesByIds(ids: string[]): Promise<ChallengeDoc[]> {
  return batchGetByIds<ChallengeDoc>(COLLECTIONS.challenges, ids);
}

/** Active challenges that have started (app discovery feed). */
export async function listActiveChallengesStarted(now: string): Promise<ChallengeDoc[]> {
  const snap = await adminDb()
    .collection(COLLECTIONS.challenges)
    .where("status", "==", "active")
    .where("starts_at", "<=", now)
    .orderBy("starts_at", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChallengeDoc);
}
