-- Phase 5: denormalized QR reward fields + encrypted token for owner re-display

ALTER TABLE qr_rewards
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES cada_users (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenges (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS token_ciphertext TEXT;

CREATE INDEX IF NOT EXISTS idx_qr_rewards_user_id ON qr_rewards (user_id);
CREATE INDEX IF NOT EXISTS idx_qr_rewards_challenge_id ON qr_rewards (challenge_id);
CREATE INDEX IF NOT EXISTS idx_qr_rewards_expires_at_issued
  ON qr_rewards (expires_at)
  WHERE status = 'issued';

COMMENT ON COLUMN qr_rewards.token_ciphertext IS
  'AES-256-GCM encrypted raw token for GET /users/me/rewards/:id re-display. Redeem uses token_hash only.';
COMMENT ON COLUMN qr_rewards.user_id IS 'Denormalized from enrollment for mobile API.';
COMMENT ON COLUMN qr_rewards.challenge_id IS 'Denormalized from enrollment for mobile API.';

-- Backfill from enrollments where possible
UPDATE qr_rewards qr
SET
  user_id = uce.user_id,
  challenge_id = uce.challenge_id
FROM user_challenge_enrollments uce
WHERE qr.enrollment_id = uce.id
  AND (qr.user_id IS NULL OR qr.challenge_id IS NULL);
