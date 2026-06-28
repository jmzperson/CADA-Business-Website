import { habitLabel } from "@/lib/challenge-form";
import type { ChallengeRow } from "@/lib/challenges";
import { sendNotificationEmail } from "@/lib/email/send-notification";

export type ChallengeSubmittedContext = {
  challenge: ChallengeRow;
  brandName: string;
  submittedByEmail: string;
};

function adminReviewUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const token = process.env.CADA_ADMIN_TOKEN?.trim();
  if (!base) return null;
  return token ? `${base}/admin/challenges?token=${encodeURIComponent(token)}` : `${base}/admin/challenges`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" });
}

export async function notifyChallengeSubmitted(
  ctx: ChallengeSubmittedContext
): Promise<{ sent: boolean; error?: string }> {
  const to = process.env.CHALLENGE_NOTIFY_EMAIL?.trim() || "james@cadaapp.com";
  const { challenge, brandName, submittedByEmail } = ctx;
  const reviewUrl = adminReviewUrl();

  const lines = [
    "A partner challenge is pending CADA approval.",
    "",
    `Brand: ${brandName}`,
    `Submitted by: ${submittedByEmail}`,
    "",
    `Title: ${challenge.title}`,
    `Habit: ${habitLabel(challenge.habit_type)}`,
    `Offer: ${challenge.offer_headline}`,
    challenge.offer_code ? `Promo code: ${challenge.offer_code}` : null,
    challenge.description ? `Description: ${challenge.description}` : null,
    `Starts: ${formatDate(challenge.starts_at)}`,
    `Ends: ${formatDate(challenge.ends_at)}`,
    challenge.max_redemptions != null ? `Max redemptions: ${challenge.max_redemptions}` : null,
    "",
    `Challenge ID: ${challenge.id}`,
    reviewUrl ? `Review queue: ${reviewUrl}` : null,
    "",
    "— CADA brand portal",
  ].filter(Boolean);

  const result = await sendNotificationEmail({
    to,
    subject: `Challenge pending review: ${brandName} — ${challenge.title}`,
    text: lines.join("\n"),
  });

  if (!result.ok) {
    console.error("[challenge-submitted] email failed:", result.error);
    return { sent: false, error: result.error };
  }

  return { sent: true };
}
