import { adminDb } from "@/lib/firebase/admin";
import { batchGetByIds, newId, nowIso } from "@/lib/db/brands";
import {
  COLLECTIONS,
  type QrRewardDoc,
  type RedemptionAttemptDoc,
  type RedemptionDoc,
} from "@/lib/db/types";

export async function getQrRewardById(id: string): Promise<QrRewardDoc | null> {
  const snap = await adminDb().collection(COLLECTIONS.qrRewards).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as QrRewardDoc;
}

export async function getQrRewardByEnrollment(enrollmentId: string): Promise<QrRewardDoc | null> {
  const db = adminDb();
  const index = await db.collection(COLLECTIONS.qrRewardsByEnrollment).doc(enrollmentId).get();
  if (!index.exists) return null;
  return getQrRewardById(index.data()?.reward_id as string);
}

export async function getQrRewardByTokenHash(tokenHash: string): Promise<QrRewardDoc | null> {
  const db = adminDb();
  const index = await db.collection(COLLECTIONS.qrRewardsByTokenHash).doc(tokenHash).get();
  if (!index.exists) return null;
  return getQrRewardById(index.data()?.reward_id as string);
}

export async function createQrReward(
  data: Omit<QrRewardDoc, "id">
): Promise<QrRewardDoc> {
  const db = adminDb();
  const id = newId();
  const row: QrRewardDoc = { id, ...data };
  const batch = db.batch();
  batch.set(db.collection(COLLECTIONS.qrRewards).doc(id), row);
  batch.set(db.collection(COLLECTIONS.qrRewardsByEnrollment).doc(data.enrollment_id), {
    reward_id: id,
  });
  batch.set(db.collection(COLLECTIONS.qrRewardsByTokenHash).doc(data.token_hash), { reward_id: id });
  await batch.commit();
  return row;
}

export async function updateQrReward(id: string, patch: Partial<QrRewardDoc>) {
  await adminDb().collection(COLLECTIONS.qrRewards).doc(id).set(patch, { merge: true });
  return getQrRewardById(id);
}

export async function listIssuedQrRewardsByChallenge(challengeId: string): Promise<QrRewardDoc[]> {
  const snap = await adminDb()
    .collection(COLLECTIONS.qrRewards)
    .where("challenge_id", "==", challengeId)
    .where("status", "==", "issued")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as QrRewardDoc);
}

export async function listQrRewardsByEnrollmentIds(enrollmentIds: string[]): Promise<QrRewardDoc[]> {
  if (enrollmentIds.length === 0) return [];
  const db = adminDb();
  const rewardIds: string[] = [];
  for (const eid of enrollmentIds) {
    const index = await db.collection(COLLECTIONS.qrRewardsByEnrollment).doc(eid).get();
    if (index.exists) rewardIds.push(index.data()?.reward_id as string);
  }
  return batchGetByIds<QrRewardDoc>(COLLECTIONS.qrRewards, rewardIds);
}

export async function expireIssuedQrRewards(): Promise<number> {
  const db = adminDb();
  const now = nowIso();
  const snap = await db.collection(COLLECTIONS.qrRewards).where("status", "==", "issued").get();
  let count = 0;
  const batch = db.batch();
  for (const doc of snap.docs) {
    if (new Date(doc.data().expires_at as string) < new Date(now)) {
      batch.update(doc.ref, { status: "expired" });
      count += 1;
    }
  }
  if (count > 0) await batch.commit();
  return count;
}

export async function listRedemptionsByChallengeIds(challengeIds: string[]): Promise<RedemptionDoc[]> {
  if (challengeIds.length === 0) return [];
  const results: RedemptionDoc[] = [];
  for (const cid of challengeIds) {
    const snap = await adminDb()
      .collection(COLLECTIONS.redemptions)
      .where("challenge_id", "==", cid)
      .get();
    results.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RedemptionDoc));
  }
  return results;
}

export async function listRedemptionsByBrand(
  brandId: string,
  from: string | null,
  to: string | null
): Promise<RedemptionDoc[]> {
  let q = adminDb().collection(COLLECTIONS.redemptions).where("brand_id", "==", brandId);
  if (from) q = q.where("redeemed_at", ">=", from);
  if (to) q = q.where("redeemed_at", "<=", to);
  const snap = await q.orderBy("redeemed_at", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RedemptionDoc);
}

export async function countRedemptionsByChallenge(challengeId: string): Promise<number> {
  const snap = await adminDb()
    .collection(COLLECTIONS.redemptions)
    .where("challenge_id", "==", challengeId)
    .get();
  return snap.size;
}

export async function createRedemption(
  data: Omit<RedemptionDoc, "id">
): Promise<RedemptionDoc> {
  const id = newId();
  const row: RedemptionDoc = { id, ...data };
  await adminDb().collection(COLLECTIONS.redemptions).doc(id).set(row);
  return row;
}

export async function getRedemptionByQrReward(qrRewardId: string): Promise<RedemptionDoc | null> {
  const snap = await adminDb()
    .collection(COLLECTIONS.redemptions)
    .where("qr_reward_id", "==", qrRewardId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as RedemptionDoc;
}

export async function createRedemptionAttempt(
  data: Omit<RedemptionAttemptDoc, "id" | "created_at">
) {
  const id = newId();
  const row: RedemptionAttemptDoc = { id, ...data, created_at: nowIso() };
  await adminDb().collection(COLLECTIONS.redemptionAttempts).doc(id).set(row);
  return row;
}

export async function listRedemptionsPaginated(
  brandId: string,
  from: string | null,
  to: string | null,
  challengeId: string | undefined,
  page: number,
  pageSize: number
): Promise<{ rows: RedemptionDoc[]; total: number }> {
  let q = adminDb().collection(COLLECTIONS.redemptions).where("brand_id", "==", brandId);
  if (challengeId) q = q.where("challenge_id", "==", challengeId);
  if (from) q = q.where("redeemed_at", ">=", from);
  if (to) q = q.where("redeemed_at", "<=", to);
  const snap = await q.orderBy("redeemed_at", "desc").get();
  const total = snap.size;
  const offset = (page - 1) * pageSize;
  const rows = snap.docs
    .slice(offset, offset + pageSize)
    .map((d) => ({ id: d.id, ...d.data() }) as RedemptionDoc);
  return { rows, total };
}

export async function countQrRewardsIssued(
  brandId: string,
  from: string,
  to: string,
  challengeId?: string
): Promise<number> {
  let q = adminDb()
    .collection(COLLECTIONS.qrRewards)
    .where("brand_id", "==", brandId)
    .where("status", "in", ["issued", "redeemed"])
    .where("issued_at", ">=", from)
    .where("issued_at", "<=", to);
  if (challengeId) q = q.where("challenge_id", "==", challengeId);
  const snap = await q.get();
  return snap.size;
}

export async function countRedemptionsInRange(
  brandId: string,
  from: string,
  to: string,
  challengeId?: string
): Promise<number> {
  let q = adminDb()
    .collection(COLLECTIONS.redemptions)
    .where("brand_id", "==", brandId)
    .where("redeemed_at", ">=", from)
    .where("redeemed_at", "<=", to);
  if (challengeId) q = q.where("challenge_id", "==", challengeId);
  const snap = await q.get();
  return snap.size;
}

export async function listQrRewardsByBrand(
  brandId: string,
  from: string | null,
  to: string | null,
  statuses: string[]
): Promise<QrRewardDoc[]> {
  let q = adminDb().collection(COLLECTIONS.qrRewards).where("brand_id", "==", brandId);
  const snap = await q.get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as QrRewardDoc)
    .filter((r) => statuses.includes(r.status))
    .filter((r) => {
      if (from && r.issued_at < from) return false;
      if (to && r.issued_at > to) return false;
      return true;
    });
}
