import { NextResponse } from "next/server";
import { getBrandById, listChallengesByStatus } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { verifyCadaAdminToken } from "@/lib/admin/auth";
import { habitLabel } from "@/lib/challenge-form";
import type { ChallengeStatus } from "@/lib/db/types";

export async function GET(request: Request) {
  try {
    if (!verifyCadaAdminToken(request)) {
      return jsonError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") || "pending_review";

    let rows;
    if (statusParam === "all") {
      const statuses: ChallengeStatus[] = [
        "draft",
        "pending_review",
        "rejected",
        "active",
        "ended",
      ];
      rows = (
        await Promise.all(statuses.map((s) => listChallengesByStatus(s, 200)))
      ).flat();
      rows.sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));
    } else {
      rows = await listChallengesByStatus(statusParam as ChallengeStatus, 200);
    }

    const brandIds = [...new Set(rows.map((r) => r.brand_id))];
    const brands = await Promise.all(brandIds.map((id) => getBrandById(id)));
    const brandById = new Map(brands.filter(Boolean).map((b) => [b!.id, b!]));

    const challenges = rows.map((row) => {
      const brand = brandById.get(row.brand_id);
      return {
        id: row.id,
        title: row.title,
        habit_type: row.habit_type,
        habit_label: habitLabel(row.habit_type),
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
