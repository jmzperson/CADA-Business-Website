import { NextResponse } from "next/server";
import { getBrandById, getChallengeById } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import {
  expireEndedChallenges,
  getRedemptionUsageByChallenge,
  isAtRedemptionCap,
  isChallengeInDiscoveryWindow,
  spotsRemaining,
} from "@/lib/challenges";
import { requireAppUser } from "@/lib/mobile/auth";
import { serializeAvailableChallenge } from "@/lib/mobile/serialize";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    await requireAppUser(request);
    await expireEndedChallenges();

    const { id } = await params;
    const row = await getChallengeById(id);
    if (!row) return jsonError("Challenge not found", 404);

    const brand = await getBrandById(row.brand_id);
    if (!row || row.status !== "active" || !brand || brand.status !== "active") {
      return jsonError("Challenge is not available", 404);
    }

    if (!isChallengeInDiscoveryWindow(row)) {
      return jsonError("Challenge is not available", 404);
    }

    const usage = (await getRedemptionUsageByChallenge([row.id]))[row.id];
    if (isAtRedemptionCap(row.max_redemptions, usage)) {
      return jsonError("Challenge redemption cap reached", 410);
    }

    return NextResponse.json({
      challenge: serializeAvailableChallenge(
        {
          id: row.id,
          title: row.title,
          description: row.description,
          habit_type: row.habit_type,
          offer_headline: row.offer_headline,
          offer_code: row.offer_code,
          starts_at: row.starts_at,
          ends_at: row.ends_at,
          max_redemptions: row.max_redemptions,
          brands: {
            id: brand.id,
            name: brand.name,
            slug: brand.slug,
            logo_url: brand.logo_url,
            category: brand.category,
          },
        },
        spotsRemaining(row.max_redemptions, usage)
      ),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
