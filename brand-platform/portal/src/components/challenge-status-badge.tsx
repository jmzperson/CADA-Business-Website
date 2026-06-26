import type { ChallengeStatus } from "@/lib/challenges";

const STYLES: Record<ChallengeStatus, string> = {
  draft: "bg-white text-ink-light border-border",
  pending_review: "bg-teal-light text-teal-dark border-teal/25",
  rejected: "bg-coral-light text-coral-dark border-coral/25",
  active: "bg-teal text-white border-teal-dark",
  ended: "bg-white text-ink-light border-border",
};

const LABELS: Record<ChallengeStatus, string> = {
  draft: "Draft",
  pending_review: "Pending CADA approval",
  rejected: "Rejected",
  active: "Active",
  ended: "Ended",
};

export function ChallengeStatusBadge({ status }: { status: ChallengeStatus }) {
  return (
    <span
      className={`inline-flex rounded-pill border-2 px-2.5 py-0.5 font-display text-xs font-extrabold ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
