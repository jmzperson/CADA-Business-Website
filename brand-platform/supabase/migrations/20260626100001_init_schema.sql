-- CADA Brand Platform — Phase 1 schema
-- Enums, tables, constraints, dashboard indexes

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE brand_category AS ENUM (
  'gym',
  'food',
  'wellness',
  'retail',
  'other'
);

CREATE TYPE brand_status AS ENUM (
  'pending',
  'active',
  'suspended'
);

CREATE TYPE brand_staff_role AS ENUM (
  'admin',
  'scanner'
);

CREATE TYPE habit_type AS ENUM (
  'gym',
  'text_friend',
  'call_family',
  'journal',
  'stretch',
  'run',
  'custom'
);

CREATE TYPE challenge_status AS ENUM (
  'draft',
  'active',
  'ended'
);

CREATE TYPE completion_rule AS ENUM (
  'single_completion'
);

CREATE TYPE enrollment_status AS ENUM (
  'active',
  'completed',
  'dropped'
);

CREATE TYPE qr_reward_status AS ENUM (
  'issued',
  'redeemed',
  'expired',
  'revoked'
);

CREATE TYPE redemption_attempt_outcome AS ENUM (
  'success',
  'invalid',
  'expired',
  'already_redeemed',
  'wrong_brand'
);

-- ---------------------------------------------------------------------------
-- CADA app users (shadow reference; identity lives in iOS app auth)
-- user_id in enrollments references this table. auth_user_id links to
-- Supabase auth.users when app and brand DB share a project.
-- ---------------------------------------------------------------------------
CREATE TABLE cada_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  UUID UNIQUE,
  display_label TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE cada_users IS
  'Reference for CADA iOS users. auth_user_id = JWT sub when using shared Supabase auth.';

-- ---------------------------------------------------------------------------
-- Brands
-- ---------------------------------------------------------------------------
CREATE TABLE brands (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  slug               TEXT NOT NULL UNIQUE,
  logo_url           TEXT,
  category           brand_category NOT NULL DEFAULT 'other',
  website            TEXT,
  offer_default_copy TEXT,
  primary_address    TEXT,
  status             brand_status NOT NULL DEFAULT 'pending',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_brands_status ON brands (status);

-- ---------------------------------------------------------------------------
-- Brand locations (optional MVP; single location per brand typical)
-- ---------------------------------------------------------------------------
CREATE TABLE brand_locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id   UUID NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_brand_locations_brand_id ON brand_locations (brand_id);

-- ---------------------------------------------------------------------------
-- Brand staff (portal users; auth_user_id → auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE brand_staff (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     UUID NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  role         brand_staff_role NOT NULL DEFAULT 'scanner',
  auth_user_id UUID UNIQUE,
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT brand_staff_email_per_brand UNIQUE (brand_id, email)
);

CREATE INDEX idx_brand_staff_brand_id ON brand_staff (brand_id);
CREATE INDEX idx_brand_staff_auth_user_id ON brand_staff (auth_user_id);

-- ---------------------------------------------------------------------------
-- Challenges
-- ---------------------------------------------------------------------------
CREATE TABLE challenges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         UUID NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  habit_type       habit_type NOT NULL,
  offer_headline   TEXT NOT NULL,
  offer_code       TEXT,
  status           challenge_status NOT NULL DEFAULT 'draft',
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ,
  completion_rule  completion_rule NOT NULL DEFAULT 'single_completion',
  max_redemptions  INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_challenges_brand_id ON challenges (brand_id);
CREATE INDEX idx_challenges_brand_status ON challenges (brand_id, status);
CREATE INDEX idx_challenges_status_starts ON challenges (status, starts_at DESC);

-- ---------------------------------------------------------------------------
-- User challenge enrollments
-- ---------------------------------------------------------------------------
CREATE TABLE user_challenge_enrollments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id     UUID NOT NULL REFERENCES challenges (id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES cada_users (id) ON DELETE CASCADE,
  status           enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  completion_count INTEGER NOT NULL DEFAULT 0 CHECK (completion_count >= 0),
  CONSTRAINT user_challenge_enrollments_unique UNIQUE (challenge_id, user_id)
);

-- Dashboard: enrollments by challenge
CREATE INDEX idx_enrollments_challenge_id ON user_challenge_enrollments (challenge_id);
CREATE INDEX idx_enrollments_challenge_status ON user_challenge_enrollments (challenge_id, status);
CREATE INDEX idx_enrollments_user_id ON user_challenge_enrollments (user_id);
CREATE INDEX idx_enrollments_enrolled_at ON user_challenge_enrollments (enrolled_at DESC);

-- ---------------------------------------------------------------------------
-- Habit completion events (attribution layer)
-- ---------------------------------------------------------------------------
CREATE TABLE habit_completion_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES cada_users (id) ON DELETE CASCADE,
  habit_type      habit_type NOT NULL,
  completed_at    TIMESTAMPTZ NOT NULL,
  source_event_id TEXT NOT NULL,
  enrollment_id   UUID REFERENCES user_challenge_enrollments (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT habit_completion_events_source_unique UNIQUE (user_id, source_event_id)
);

-- Dashboard: completions by date
CREATE INDEX idx_habit_completions_completed_at ON habit_completion_events (completed_at DESC);
CREATE INDEX idx_habit_completions_enrollment_id ON habit_completion_events (enrollment_id)
  WHERE enrollment_id IS NOT NULL;
CREATE INDEX idx_habit_completions_user_completed ON habit_completion_events (user_id, completed_at DESC);

-- ---------------------------------------------------------------------------
-- QR rewards
-- ---------------------------------------------------------------------------
CREATE TABLE qr_rewards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL UNIQUE REFERENCES user_challenge_enrollments (id) ON DELETE CASCADE,
  brand_id      UUID NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  status        qr_reward_status NOT NULL DEFAULT 'issued',
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  redeemed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qr_rewards_redeemed_at_check CHECK (
    (status = 'redeemed' AND redeemed_at IS NOT NULL)
    OR (status <> 'redeemed')
  )
);

CREATE INDEX idx_qr_rewards_brand_id ON qr_rewards (brand_id);
CREATE INDEX idx_qr_rewards_brand_status ON qr_rewards (brand_id, status);
CREATE INDEX idx_qr_rewards_status_issued_at ON qr_rewards (status, issued_at DESC);

-- ---------------------------------------------------------------------------
-- Redemptions
-- ---------------------------------------------------------------------------
CREATE TABLE redemptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_reward_id UUID NOT NULL UNIQUE REFERENCES qr_rewards (id) ON DELETE RESTRICT,
  brand_id     UUID NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  staff_id     UUID NOT NULL REFERENCES brand_staff (id) ON DELETE RESTRICT,
  location_id  UUID REFERENCES brand_locations (id) ON DELETE SET NULL,
  redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Dashboard: redemptions by brand
CREATE INDEX idx_redemptions_brand_id ON redemptions (brand_id);
CREATE INDEX idx_redemptions_brand_redeemed_at ON redemptions (brand_id, redeemed_at DESC);
CREATE INDEX idx_redemptions_staff_id ON redemptions (staff_id);

-- ---------------------------------------------------------------------------
-- Redemption attempts (audit)
-- ---------------------------------------------------------------------------
CREATE TABLE redemption_attempts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL,
  brand_id   UUID REFERENCES brands (id) ON DELETE SET NULL,
  staff_id   UUID REFERENCES brand_staff (id) ON DELETE SET NULL,
  outcome    redemption_attempt_outcome NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_redemption_attempts_brand_created ON redemption_attempts (brand_id, created_at DESC);
CREATE INDEX idx_redemption_attempts_token_hash ON redemption_attempts (token_hash);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER challenges_updated_at
  BEFORE UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
