import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { createChallenge, getBrandById, listChallengesByBrand } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import {
  getChallengeMetrics,
  parseChallengeInput,
  serializeChallenge,
  type ChallengeRow,
} from "@/lib/challenges";
import { submitChallengeForReview } from "@/lib/challenges/submit-for-review";

type CreateBody = Record<string, unknown> & { submit_for_review?: boolean };

export async function GET() {
  try {
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);

    const rows = (await listChallengesByBrand(staff.brandId)) as ChallengeRow[];
    const metrics = await getChallengeMetrics(rows.map((r) => r.id));

    return NextResponse.json({
      challenges: rows.map((row) => serializeChallenge(row, metrics[row.id])),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);
    if (staff.role !== "admin") {
      return jsonError("Only admins can create challenges", 403);
    }

    const body = (await request.json()) as CreateBody;
    const submitForReview = body.submit_for_review === true;
    const { data, errors } = parseChallengeInput(body);

    if (errors.length > 0) {
      return jsonError(errors.join("; "));
    }

    const row = (await createChallenge({
      brand_id: staff.brandId,
      title: data.title as string,
      description: (data.description as string) ?? "",
      habit_type: data.habit_type as string,
      offer_headline: data.offer_headline as string,
      offer_code: (data.offer_code as string | null) ?? null,
      status: "draft",
      starts_at: data.starts_at as string,
      ends_at: (data.ends_at as string | null) ?? null,
      completion_rule: "single_completion",
      max_redemptions: (data.max_redemptions as number | null) ?? null,
      published_at: null,
      submitted_at: null,
      reviewed_at: null,
      reviewed_by: null,
      rejection_reason: null,
    })) as ChallengeRow;

    if (submitForReview) {
      const brand = await getBrandById(staff.brandId);

      const submit = await submitChallengeForReview({
        challengeId: row.id,
        brandId: staff.brandId,
        brandName: brand?.name ?? "Unknown brand",
        submittedByEmail: staff.email,
      });

      if (!submit.ok) {
        return NextResponse.json(
          {
            error: submit.error,
            challenge: serializeChallenge(row),
          },
          { status: submit.status }
        );
      }

      const metrics = await getChallengeMetrics([submit.challenge.id]);
      return NextResponse.json(
        {
          challenge: serializeChallenge(submit.challenge, metrics[submit.challenge.id]),
          message: "Submitted for CADA approval.",
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { challenge: serializeChallenge(row) },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
