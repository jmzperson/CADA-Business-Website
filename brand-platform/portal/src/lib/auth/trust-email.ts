import { adminAuth } from "@/lib/firebase/admin";

/** Password sign-in proves email ownership — mark verified so Firebase stays in sync. */
export async function trustEmailFromPasswordAuth(uid: string) {
  const user = await adminAuth().getUser(uid);
  if (!user.emailVerified) {
    await adminAuth().updateUser(uid, { emailVerified: true });
  }
}
