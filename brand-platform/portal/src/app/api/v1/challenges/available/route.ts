import { NextResponse } from "next/server";
import { getBrandById, listActiveChallengesStarted } from "@/lib/db";
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

export async function GET(request: Request) {
  try {
    await requireAppUser(request);
    await expireEndedChallenges();

    const now = new Date().toISOString();
    const allRows = await listActiveChallengesStarted(now);

    const rows = [];
    for (const row of allRows) {
      const brand = await getBrandById(row.brand_id);
      if (!brand || brand.status !== "active") continue;
      if (
        !isChallengeInDiscoveryWindow({
          starts_at: row.starts_at,
          ends_at: row.ends_at,
        })
      ) {
        continue;
      }
      rows.push({ ...row, brands: brand });
    }

    const usageByChallenge = await getRedemptionUsageByChallenge(rows.map((row) => row.id));

    const challenges = rows
      .filter((row) => {
        const usage = usageByChallenge[row.id];
        return !isAtRedemptionCap(row.max_redemptions, usage);
      })
      .map((row) => {
        const usage = usageByChallenge[row.id];
        return serializeAvailableChallenge(
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
              id: row.brands.id,
              name: row.brands.name,
              slug: row.brands.slug,
              logo_url: row.brands.logo_url,
              category: row.brands.category,
            },
          },
          spotsRemaining(row.max_redemptions, usage)
        );
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
