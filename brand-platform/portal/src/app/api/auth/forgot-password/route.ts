import { NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/firebase/auth-rest";
import { handleApiError, jsonError } from "@/lib/api";

type Body = { email?: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const email = body.email?.trim().toLowerCase();

    if (!email) return jsonError("email is required");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    try {
      await sendPasswordResetEmail(email, `${appUrl}/reset-password`);
    } catch {
      // Do not reveal whether the account exists
    }

    return NextResponse.json({
      message: "If an account exists for this email, you'll receive a reset link shortly.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
