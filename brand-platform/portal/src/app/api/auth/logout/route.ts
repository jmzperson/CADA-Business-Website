import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handleApiError } from "@/lib/api";
import { PORTAL_SESSION_COOKIE, portalSessionCookieOptions } from "@/lib/firebase/session";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.set(PORTAL_SESSION_COOKIE, "", { ...portalSessionCookieOptions(0), maxAge: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
