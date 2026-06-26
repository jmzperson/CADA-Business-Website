import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api";

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
