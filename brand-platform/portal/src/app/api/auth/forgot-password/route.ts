import { NextResponse } from "next/server";
import { sendPortalPasswordResetEmail } from "@/lib/auth/send-password-reset";
import { jsonError } from "@/lib/api";

type Body = { email?: string };

const GENERIC_MESSAGE =
  "If an account exists for this email, you'll receive a reset link shortly.";

export async function POST(request: Request) {
  try {
    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return jsonError("Invalid JSON body");
    }
    const email = body.email?.trim().toLowerCase();

    if (!email) return jsonError("email is required");

    const result = await sendPortalPasswordResetEmail(email);

    if (result.ok) {
      console.info(`[password-reset] Sent via ${result.provider} for ${email}`);
    } else if (result.reason === "user-not-found") {
      // Expected — do not reveal whether the account exists
    } else {
      console.error(`[password-reset] Failed for ${email}:`, result.detail ?? result.reason);
    }

    // Always return the same message (including delivery failures) so we don't
    // leak account existence or leave users on a raw 500 from Auth config issues.
    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (err) {
    console.error("[password-reset] Unhandled error:", err);
    // Prefer a soft success response over Internal Server Error for this endpoint.
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }
}
