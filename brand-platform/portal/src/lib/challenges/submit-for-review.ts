import { getChallengeForBrand, updateChallenge } from "@/lib/db";
import { notifyChallengeSubmitted } from "@/lib/email/challenge-submitted";
import {
  validatePublishFields,
  type ChallengeRow,
} from "@/lib/challenges";

export type SubmitForReviewResult =
  | { ok: true; challenge: ChallengeRow }
  | { ok: false; status: number; error: string };

/** Move a draft/rejected challenge to pending_review and notify CADA. */
export async function submitChallengeForReview(params: {
  challengeId: string;
  brandId: string;
  brandName: string;
  submittedByEmail: string;
}): Promise<SubmitForReviewResult> {
  const row = await getChallengeForBrand(params.challengeId, params.brandId);
  if (!row) {
    return { ok: false, status: 404, error: "Challenge not found" };
  }

  if (row.status !== "draft" && row.status !== "rejected") {
    return {
      ok: false,
      status: 409,
      error: "Only draft or rejected challenges can be submitted for review",
    };
  }

  const errors = validatePublishFields(row as ChallengeRow);
  if (errors.length > 0) {
    return { ok: false, status: 400, error: `Cannot submit: ${errors.join("; ")}` };
  }

  const now = new Date().toISOString();

  const updated = await updateChallenge(params.challengeId, {
    status: "pending_review",
    submitted_at: now,
    rejection_reason: null,
    reviewed_at: null,
    reviewed_by: null,
  });

  if (!updated) {
    return { ok: false, status: 500, error: "Submit failed" };
  }

  void notifyChallengeSubmitted({
    challenge: updated as ChallengeRow,
    brandName: params.brandName,
    submittedByEmail: params.submittedByEmail,
  });

  return { ok: true, challenge: updated as ChallengeRow };
}
