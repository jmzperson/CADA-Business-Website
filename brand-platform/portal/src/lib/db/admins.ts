import { adminDb } from "@/lib/firebase/admin";
import { nowIso } from "@/lib/db/brands";
import { COLLECTIONS, type CadaAdminDoc } from "@/lib/db/types";

function adminRef(email: string) {
  return adminDb().collection(COLLECTIONS.cadaAdmins).doc(email);
}

export async function getCadaAdminByEmail(email: string): Promise<CadaAdminDoc | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const snap = await adminRef(normalized).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as CadaAdminDoc;
}

export async function listCadaAdmins(): Promise<CadaAdminDoc[]> {
  const snap = await adminDb().collection(COLLECTIONS.cadaAdmins).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as CadaAdminDoc))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function countEnabledCadaAdmins(): Promise<number> {
  const all = await listCadaAdmins();
  return all.filter((row) => !row.disabled).length;
}

export async function upsertCadaAdmin(params: {
  email: string;
  authUserId: string | null;
  grantedBy: string;
  disabled?: boolean;
}): Promise<CadaAdminDoc> {
  const email = params.email.trim().toLowerCase();
  const existing = await getCadaAdminByEmail(email);
  const ts = nowIso();
  const reGrant = !existing || existing.disabled;
  const row: CadaAdminDoc = {
    id: email,
    email,
    auth_user_id: params.authUserId ?? existing?.auth_user_id ?? null,
    granted_by: existing && !reGrant ? existing.granted_by : params.grantedBy,
    granted_at: existing && !reGrant ? existing.granted_at : ts,
    disabled: params.disabled ?? false,
    updated_at: ts,
  };
  await adminRef(email).set(row, { merge: true });
  return (await getCadaAdminByEmail(email)) ?? row;
}

export async function disableCadaAdmin(email: string): Promise<CadaAdminDoc | null> {
  const existing = await getCadaAdminByEmail(email);
  if (!existing) return null;
  const ts = nowIso();
  await adminRef(existing.email).set({ disabled: true, updated_at: ts }, { merge: true });
  return getCadaAdminByEmail(existing.email);
}
