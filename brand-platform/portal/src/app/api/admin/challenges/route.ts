import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, jsonError } from "@/lib/api";
import { verifyCadaAdminToken } from "@/lib/admin/auth";
import { habitLabel } from "@/lib/challenge-form";

export async function GET(request: Request) {
  try {
    if (!verifyCadaAdminToken(request)) {
      return jsonError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending_review";

    const admin = createAdminClient();
    let query = admin
      .from("challenges")
      .select(
        `
        id,
        title,
        habit_type,
        offer_headline,
        status,
        submitted_at,
        rejection_reason,
        brands ( id, name )
      `
      )
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(200);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);

    const challenges = (data ?? []).map((row) => {
      const brand = row.brands as { id: string; name: string } | null;
      return {
        id: row.id,
        title: row.title,
        habit_type: row.habit_type,
        habit_label: habitLabel(row.habit_type as string),
        offer_headline: row.offer_headline,
        status: row.status,
        submitted_at: row.submitted_at,
        rejection_reason: row.rejection_reason,
        brand_id: brand?.id ?? "",
        brand_name: brand?.name ?? "—",
      };
    });

    return NextResponse.json({ challenges });
  } catch (err) {
    return handleApiError(err);
  }
}
