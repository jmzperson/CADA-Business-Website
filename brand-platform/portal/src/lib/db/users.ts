import { adminDb } from "@/lib/firebase/admin";
import { batchGetByIds, newId, nowIso } from "@/lib/db/brands";
import {
  COLLECTIONS,
  type CadaUserDoc,
  type EnrollmentDoc,
  type HabitCompletionEventDoc,
} from "@/lib/db/types";

// --- CADA app users (separate from portal brand_staff) ---

export async function getCadaUserByAuthId(authUserId: string): Promise<CadaUserDoc | null> {
  const db = adminDb();
  const index = await db.collection(COLLECTIONS.cadaUsersByAuth).doc(authUserId).get();
  if (!index.exists) return null;
  const userId = index.data()?.user_id as string;
  const snap = await db.collection(COLLECTIONS.cadaUsers).doc(userId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as CadaUserDoc;
}

export async function getCadaUserById(id: string): Promise<CadaUserDoc | null> {
  const snap = await adminDb().collection(COLLECTIONS.cadaUsers).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as CadaUserDoc;
}

export async function ensureCadaUser(authUserId: string): Promise<CadaUserDoc> {
  const existing = await getCadaUserByAuthId(authUserId);
  if (existing) return existing;

  const db = adminDb();
  const id = newId();
  const ts = nowIso();
  const label = `User #${id.slice(0, 4).toUpperCase()}`;
  const user: CadaUserDoc = {
    id,
    auth_user_id: authUserId,
    display_label: label,
    created_at: ts,
  };
  const batch = db.batch();
  batch.set(db.collection(COLLECTIONS.cadaUsers).doc(id), user);
  batch.set(db.collection(COLLECTIONS.cadaUsersByAuth).doc(authUserId), { user_id: id });
  await batch.commit();
  return user;
}

export async function getCadaUsersByIds(ids: string[]): Promise<CadaUserDoc[]> {
  return batchGetByIds<CadaUserDoc>(COLLECTIONS.cadaUsers, ids);
}

// --- Enrollments ---

export async function getEnrollmentById(id: string): Promise<EnrollmentDoc | null> {
  const snap = await adminDb().collection(COLLECTIONS.enrollments).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as EnrollmentDoc;
}

export async function getEnrollmentByChallengeAndUser(
  challengeId: string,
  userId: string
): Promise<EnrollmentDoc | null> {
  const snap = await adminDb()
    .collection(COLLECTIONS.enrollments)
    .where("challenge_id", "==", challengeId)
    .where("user_id", "==", userId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as EnrollmentDoc;
}

export async function listEnrollmentsByUser(userId: string): Promise<EnrollmentDoc[]> {
  const snap = await adminDb()
    .collection(COLLECTIONS.enrollments)
    .where("user_id", "==", userId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EnrollmentDoc);
}

export async function listEnrollmentsByChallenge(challengeId: string): Promise<EnrollmentDoc[]> {
  const snap = await adminDb()
    .collection(COLLECTIONS.enrollments)
    .where("challenge_id", "==", challengeId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EnrollmentDoc);
}

export async function listEnrollmentsByChallengeIds(
  challengeIds: string[]
): Promise<EnrollmentDoc[]> {
  if (challengeIds.length === 0) return [];
  const results: EnrollmentDoc[] = [];
  for (const challengeId of challengeIds) {
    const rows = await listEnrollmentsByChallenge(challengeId);
    results.push(...rows);
  }
  return results;
}

export async function createEnrollment(
  data: Omit<EnrollmentDoc, "id">
): Promise<EnrollmentDoc> {
  const db = adminDb();
  const id = newId();
  const row: EnrollmentDoc = { id, ...data };
  await db.collection(COLLECTIONS.enrollments).doc(id).set(row);
  return row;
}

export async function updateEnrollment(id: string, patch: Partial<EnrollmentDoc>) {
  await adminDb().collection(COLLECTIONS.enrollments).doc(id).set(patch, { merge: true });
  return getEnrollmentById(id);
}

export async function countEnrollmentsForChallenge(challengeId: string): Promise<number> {
  const snap = await adminDb()
    .collection(COLLECTIONS.enrollments)
    .where("challenge_id", "==", challengeId)
    .get();
  return snap.size;
}

export async function filterEnrollmentsByChallengeIds(
  challengeIds: string[],
  predicate: (row: EnrollmentDoc) => boolean
): Promise<EnrollmentDoc[]> {
  const rows = await listEnrollmentsByChallengeIds(challengeIds);
  return rows.filter(predicate);
}

// --- Habit completion events ---

export async function getHabitEventBySource(
  userId: string,
  sourceEventId: string
): Promise<HabitCompletionEventDoc | null> {
  const db = adminDb();
  const key = `${userId}_${sourceEventId}`;
  const index = await db.collection(COLLECTIONS.habitEventsBySource).doc(key).get();
  if (!index.exists) return null;
  const eventId = index.data()?.event_id as string;
  const snap = await db.collection(COLLECTIONS.habitEvents).doc(eventId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as HabitCompletionEventDoc;
}

export async function createHabitEvent(
  data: Omit<HabitCompletionEventDoc, "id">
): Promise<HabitCompletionEventDoc> {
  const db = adminDb();
  const id = newId();
  const row: HabitCompletionEventDoc = { id, ...data };
  const batch = db.batch();
  batch.set(db.collection(COLLECTIONS.habitEvents).doc(id), row);
  batch.set(db.collection(COLLECTIONS.habitEventsBySource).doc(`${data.user_id}_${data.source_event_id}`), {
    event_id: id,
  });
  await batch.commit();
  return row;
}

export async function listHabitEventsByEnrollment(enrollmentId: string) {
  const snap = await adminDb()
    .collection(COLLECTIONS.habitEvents)
    .where("enrollment_id", "==", enrollmentId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HabitCompletionEventDoc);
}

export async function listHabitEventsByEnrollmentIds(enrollmentIds: string[]) {
  if (enrollmentIds.length === 0) return [];
  const results: HabitCompletionEventDoc[] = [];
  for (const eid of enrollmentIds) {
    results.push(...(await listHabitEventsByEnrollment(eid)));
  }
  return results;
}
