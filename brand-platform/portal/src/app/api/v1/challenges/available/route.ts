import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, jsonError } from "@/lib/api";
import { requireAppUser } from "@/lib/mobile/auth";
import { serializeAvailableChallenge } from "@/lib/mobile/serialize";

export async function GET(request: Request) {
  try {
    await requireAppUser(request);
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data, error } = await admin
      .from("challenges")
      .select(
        `
        id,
        title,
        description,
        habit_type,
        offer_headline,
        offer_code,
        starts_at,
        ends_at,
        brands!inner (
          id,
          name,
          slug,
          logo_url,
          category,
          status
        )
      `
      )
      .eq("status", "active")
      .eq("brands.status", "active")
      .lte("starts_at", now)
      .order("starts_at", { ascending: false });

    if (error) return jsonError(error.message, 500);

    const challenges = (data || [])
      .filter((row) => {
        if (!row.ends_at) return true;
        return new Date(row.ends_at as string) > new Date();
      })
      .map((row) => {
        const brands = row.brands as {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          category: string;
        };
        return serializeAvailableChallenge({
          id: row.id,
          title: row.title,
          description: row.description,
          habit_type: row.habit_type,
          offer_headline: row.offer_headline,
          offer_code: row.offer_code,
          starts_at: row.starts_at,
          ends_at: row.ends_at,
          brands,
        });
      });

    return NextResponse.json({
      challenges,
      meta: {
        region: "all",
        count: challenges.length,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
