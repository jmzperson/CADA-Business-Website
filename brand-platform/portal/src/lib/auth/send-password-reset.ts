import { passwordResetEmail } from "@/lib/email/password-reset";
import { sendNotificationEmail } from "@/lib/email/send-notification";
import { sendPasswordResetEmail } from "@/lib/firebase/auth-rest";
import { adminAuth } from "@/lib/firebase/admin";

export type PasswordResetResult =
  | { ok: true; provider: "resend" | "google_apps_script" | "firebase" }
  | { ok: false; reason: "user-not-found" | "delivery-failed"; detail?: string };

function portalAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  // Production portal host (authorized / reachable today).
  return "https://the-cada-portal.vercel.app";
}

/** Always-allowlisted Firebase Auth domain — used for ActionCodeSettings.url. */
function firebaseContinueUrl() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "cada-4ed7c";
  return `https://${projectId}.firebaseapp.com`;
}

/** Build a link to our reset page using the oobCode from Firebase's action link. */
function portalResetUrl(firebaseActionLink: string, appUrl: string): string {
  try {
    const parsed = new URL(firebaseActionLink);
    const oobCode = parsed.searchParams.get("oobCode");
    if (!oobCode) return firebaseActionLink;
    return `${appUrl}/reset-password?oobCode=${encodeURIComponent(oobCode)}`;
  } catch {
    return firebaseActionLink;
  }
}

async function sendViaResend(email: string, resetUrl: string): Promise<PasswordResetResult> {
  const content = passwordResetEmail({ resetUrl });
  const sent = await sendNotificationEmail({
    to: email,
    subject: content.subject,
    text: content.text,
  });

  if (sent.ok) {
    return { ok: true, provider: sent.provider };
  }

  return { ok: false, reason: "delivery-failed", detail: sent.error };
}

/**
 * Send a password reset email — Resend when configured, otherwise Firebase's built-in mailer.
 *
 * generatePasswordResetLink requires ActionCodeSettings.url to be on a Firebase Auth
 * authorized domain. We use *.firebaseapp.com (always allowlisted), then rewrite the
 * oobCode into our portal reset page for the custom email path.
 */
export async function sendPortalPasswordResetEmail(email: string): Promise<PasswordResetResult> {
  const appUrl = portalAppUrl();
  const continueUrl = firebaseContinueUrl();

  let resetUrl: string;
  try {
    const firebaseLink = await adminAuth().generatePasswordResetLink(email, {
      url: continueUrl,
    });
    resetUrl = portalResetUrl(firebaseLink, appUrl);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    const message = err instanceof Error ? err.message : String(err);
    if (code === "auth/user-not-found" || message.toLowerCase().includes("user not found")) {
      return { ok: false, reason: "user-not-found" };
    }
    console.error("[password-reset] generatePasswordResetLink failed:", code || message);
    // Fall through to Firebase's built-in mailer (no custom portal link rewrite).
    try {
      await sendPasswordResetEmail(email, continueUrl);
      return { ok: true, provider: "firebase" };
    } catch (fallbackErr) {
      const fallbackMessage =
        fallbackErr instanceof Error ? fallbackErr.message : "Firebase password reset failed";
      console.error("[password-reset] Firebase fallback failed:", fallbackMessage);
      return { ok: false, reason: "delivery-failed", detail: fallbackMessage };
    }
  }

  const hasCustomMailer =
    Boolean(process.env.RESEND_API_KEY?.trim()) ||
    Boolean(process.env.GOOGLE_APPS_SCRIPT_URL?.trim());

  if (hasCustomMailer) {
    const viaResend = await sendViaResend(email, resetUrl);
    if (viaResend.ok) return viaResend;

    console.error("[password-reset] Custom mailer failed, falling back to Firebase:", viaResend.detail);
  }

  try {
    await sendPasswordResetEmail(email, continueUrl);
    return { ok: true, provider: "firebase" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Firebase password reset failed";
    console.error("[password-reset] Firebase fallback failed:", message);
    return { ok: false, reason: "delivery-failed", detail: message };
  }
}
