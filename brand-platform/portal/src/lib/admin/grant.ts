import { randomBytes } from "crypto";
import { adminAuth } from "@/lib/firebase/admin";
import { setCadaAdminClaim } from "@/lib/firebase/portal-claims";
import {
  countEnabledCadaAdmins,
  getCadaAdminByEmail,
  upsertCadaAdmin,
} from "@/lib/db/admins";
import { sendPortalPasswordResetEmail } from "@/lib/auth/send-password-reset";
import { sendNotificationEmail } from "@/lib/email/send-notification";
import { adminInviteEmail } from "@/lib/email/admin-invite";

export type GrantCadaAdminResult = {
  email: string;
  auth_user_id: string;
  created_user: boolean;
  email_sent: boolean;
  email_error?: string;
};

function tempPassword() {
  return `CadaAdmin-${randomBytes(9).toString("base64url")}A1!`;
}

async function getOrCreateAuthUser(email: string): Promise<{ uid: string; created: boolean }> {
  try {
    const user = await adminAuth().getUserByEmail(email);
    return { uid: user.uid, created: false };
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code !== "auth/user-not-found") throw err;
    const user = await adminAuth().createUser({
      email,
      password: tempPassword(),
      emailVerified: true,
    });
    return { uid: user.uid, created: true };
  }
}

function portalAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "https://the-cada-portal.vercel.app"
  );
}

/** Record a platform admin who signed in via env allowlist or existing claim. */
export async function ensureCadaAdminOnLogin(params: {
  email: string;
  authUserId: string;
}) {
  const email = params.email.trim().toLowerCase();
  const existing = await getCadaAdminByEmail(email);
  if (existing?.disabled) return existing;
  return upsertCadaAdmin({
    email,
    authUserId: params.authUserId,
    grantedBy: existing?.granted_by || "login",
    disabled: false,
  });
}

/** Grant platform admin: Firestore roster + Firebase claim + invite email. */
export async function grantCadaAdmin(params: {
  email: string;
  grantedBy: string;
  sendInvite?: boolean;
}): Promise<GrantCadaAdminResult> {
  const email = params.email.trim().toLowerCase();
  if (!email.includes("@")) {
    throw new Error("A valid email is required");
  }

  const { uid, created } = await getOrCreateAuthUser(email);
  await setCadaAdminClaim(uid, true);
  await upsertCadaAdmin({
    email,
    authUserId: uid,
    grantedBy: params.grantedBy,
    disabled: false,
  });

  let emailSent = false;
  let emailError: string | undefined;

  if (params.sendInvite !== false) {
    if (created) {
      const reset = await sendPortalPasswordResetEmail(email);
      if (!reset.ok) {
        emailError = reset.detail || "Failed to send password setup email";
      }
    }

    const appUrl = portalAppUrl();
    const content = adminInviteEmail({
      loginUrl: `${appUrl}/login`,
      reviewUrl: `${appUrl}/admin/challenges`,
      createdUser: created,
      resetSent: created,
    });
    const sent = await sendNotificationEmail({
      to: email,
      subject: content.subject,
      text: content.text,
    });
    emailSent = sent.ok;
    if (!sent.ok) {
      emailError = emailError || sent.error;
    }
  }

  return {
    email,
    auth_user_id: uid,
    created_user: created,
    email_sent: emailSent,
    email_error: emailError,
  };
}

export type RevokeCadaAdminResult = {
  email: string;
  disabled: true;
};

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

/** Revoke platform admin. Writes a disabled roster row so env allowlist cannot resurrect them. */
export async function revokeCadaAdmin(params: {
  email: string;
  actorEmail: string;
}): Promise<RevokeCadaAdminResult> {
  const email = params.email.trim().toLowerCase();
  if (email === params.actorEmail.trim().toLowerCase()) {
    throw httpError("You cannot revoke your own admin access", 400);
  }

  const existing = await getCadaAdminByEmail(email);
  const enabledCount = await countEnabledCadaAdmins();
  if (existing && !existing.disabled && enabledCount <= 1) {
    throw httpError("Cannot revoke the last CADA admin", 409);
  }

  let uid = existing?.auth_user_id ?? null;
  if (!uid) {
    try {
      uid = (await adminAuth().getUserByEmail(email)).uid;
    } catch {
      uid = null;
    }
  }

  if (uid) {
    await setCadaAdminClaim(uid, false);
  }

  await upsertCadaAdmin({
    email,
    authUserId: uid,
    grantedBy: params.actorEmail,
    disabled: true,
  });

  return { email, disabled: true };
}
