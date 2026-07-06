import { NextResponse } from "next/server";
import { sendPortalPasswordResetEmail } from "@/lib/auth/send-password-reset";
import { handleApiError, jsonError } from "@/lib/api";

type Body = { email?: string };

const GENERIC_MESSAGE =
  "If an account exists for this email, you'll receive a reset link shortly.";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
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

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (err) {
    return handleApiError(err);
  }
}
