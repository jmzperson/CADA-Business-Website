-- Challenge CADA admin review workflow

ALTER TYPE challenge_status ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE challenge_status ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_challenges_status_submitted
  ON challenges (status, submitted_at DESC)
  WHERE status = 'pending_review';

COMMENT ON COLUMN challenges.submitted_at IS 'When brand submitted for CADA review.';
COMMENT ON COLUMN challenges.reviewed_at IS 'When CADA admin approved or rejected.';
COMMENT ON COLUMN challenges.rejection_reason IS 'Set when CADA rejects; brand can edit and resubmit.';
