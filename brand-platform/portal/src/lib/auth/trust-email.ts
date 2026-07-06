import { adminAuth } from "@/lib/firebase/admin";

/** Password sign-in proves email ownership — unlock the portal without a verification email. */
export async function trustEmailFromPasswordAuth(uid: string) {
  if (process.env.SKIP_EMAIL_VERIFICATION === "true") return;
  const user = await adminAuth().getUser(uid);
  if (!user.emailVerified) {
    await adminAuth().updateUser(uid, { emailVerified: true });
  }
}
