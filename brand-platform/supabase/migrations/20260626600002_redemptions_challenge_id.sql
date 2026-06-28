-- Denormalize challenge_id on redemptions for per-challenge tracking and metrics.

ALTER TABLE redemptions
  ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenges (id) ON DELETE RESTRICT;

UPDATE redemptions r
SET challenge_id = qr.challenge_id
FROM qr_rewards qr
WHERE r.qr_reward_id = qr.id
  AND r.challenge_id IS NULL
  AND qr.challenge_id IS NOT NULL;

UPDATE redemptions r
SET challenge_id = uce.challenge_id
FROM qr_rewards qr
JOIN user_challenge_enrollments uce ON uce.id = qr.enrollment_id
WHERE r.qr_reward_id = qr.id
  AND r.challenge_id IS NULL;

ALTER TABLE redemptions
  ALTER COLUMN challenge_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_redemptions_challenge_id ON redemptions (challenge_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_challenge_redeemed_at
  ON redemptions (challenge_id, redeemed_at DESC);

COMMENT ON COLUMN redemptions.challenge_id IS
  'Denormalized from qr_rewards for challenge-level redemption counts and logs.';
