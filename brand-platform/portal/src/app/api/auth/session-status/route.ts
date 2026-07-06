import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { getPortalSessionUser } from "@/lib/firebase/session";
import { handleApiError, jsonError } from "@/lib/api";

export async function GET() {
  try {
    const decoded = await getPortalSessionUser();
    if (!decoded) return jsonError("Unauthorized", 401);

    const user = await adminAuth().getUser(decoded.uid);

    return NextResponse.json({
      email: user.email ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
