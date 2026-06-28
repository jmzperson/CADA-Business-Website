import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { getPortalSessionUser } from "@/lib/firebase/session";
import { sendNotificationEmail } from "@/lib/email/send-notification";
import { handleApiError, jsonError } from "@/lib/api";

type Body = { continue_url?: string };

export async function POST(request: Request) {
  try {
    const decoded = await getPortalSessionUser();
    if (!decoded) return jsonError("Unauthorized", 401);

    const user = await adminAuth().getUser(decoded.uid);
    if (!user.email) return jsonError("No email on file", 400);
    if (user.emailVerified) {
      return NextResponse.json({ message: "Email already verified." });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const continuePath =
      body.continue_url &&
      body.continue_url.startsWith("/") &&
      !body.continue_url.startsWith("//")
        ? body.continue_url
        : "/dashboard?welcome=1";

    const verifyLink = await adminAuth().generateEmailVerificationLink(user.email, {
      url: `${appUrl}/verify-email?next=${encodeURIComponent(continuePath)}`,
    });

    const sent = await sendNotificationEmail({
      to: user.email,
      subject: "Verify your CADA partner account",
      text: `Verify your email to access the CADA Partners dashboard:\n\n${verifyLink}\n\n— CADA`,
    });

    if (!sent.ok) {
      return jsonError(sent.error, 500);
    }

    return NextResponse.json({ message: "Verification email sent. Check your inbox." });
  } catch (err) {
    return handleApiError(err);
  }
}
