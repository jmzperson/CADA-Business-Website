import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { getPortalSessionUser } from "@/lib/firebase/session";
import { handleApiError, jsonError } from "@/lib/api";

export async function GET() {
  try {
    const decoded = await getPortalSessionUser();
    if (!decoded) return jsonError("Unauthorized", 401);

    const skip = process.env.SKIP_EMAIL_VERIFICATION === "true";
    const user = await adminAuth().getUser(decoded.uid);

    return NextResponse.json({
      email: user.email ?? null,
      email_verified: skip || user.emailVerified,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
