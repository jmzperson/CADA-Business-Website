-- CADA Brand Platform — development seed
-- Run as superuser (bypasses RLS). Brand A + Brand B for isolation tests.

BEGIN;

CREATE TABLE IF NOT EXISTS auth.users (
  id         UUID PRIMARY KEY,
  email      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-4111-8111-111111111101', 'admin@studioflow.test'),
  ('11111111-1111-4111-8111-111111111102', 'scanner@studioflow.test'),
  ('22222222-2222-4222-8222-222222222201', 'admin@rivalgym.test'),
  ('33333333-3333-4333-8333-333333333301', 'app-user-1@cada.test'),
  ('33333333-3333-4333-8333-333333333302', 'app-user-2@cada.test'),
  ('33333333-3333-4333-8333-333333333303', 'app-user-3@cada.test'),
  ('33333333-3333-4333-8333-333333333304', 'app-user-4@cada.test'),
  ('33333333-3333-4333-8333-333333333305', 'app-user-5@cada.test'),
  ('33333333-3333-4333-8333-333333333306', 'app-user-6@cada.test'),
  ('33333333-3333-4333-8333-333333333307', 'app-user-7@cada.test'),
  ('33333333-3333-4333-8333-333333333308', 'app-user-8@cada.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cada_users (id, auth_user_id, display_label) VALUES
  ('c0000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333301', 'User #A1'),
  ('c0000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333302', 'User #A2'),
  ('c0000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333303', 'User #B3'),
  ('c0000000-0000-4000-8000-000000000004', '33333333-3333-4333-8333-333333333304', 'User #C4'),
  ('c0000000-0000-4000-8000-000000000005', '33333333-3333-4333-8333-333333333305', 'User #D5'),
  ('c0000000-0000-4000-8000-000000000006', '33333333-3333-4333-8333-333333333306', 'User #E6'),
  ('c0000000-0000-4000-8000-000000000007', '33333333-3333-4333-8333-333333333307', 'User #F7'),
  ('c0000000-0000-4000-8000-000000000008', '33333333-3333-4333-8333-333333333308', 'User #G8')
ON CONFLICT (id) DO NOTHING;

INSERT INTO brands (id, name, slug, logo_url, category, website, offer_default_copy, primary_address, status) VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'Studio Flow Yoga',
    'studio-flow-yoga',
    'https://cdn.example.com/studio-flow-logo.png',
    'wellness',
    'https://studioflow.test',
    'First class free for CADA members',
    '42 Mercer St, New York, NY',
    'active'
  ),
  (
    'b0000000-0000-4000-8000-000000000001',
    'Rival Gym',
    'rival-gym',
    NULL,
    'gym',
    'https://rivalgym.test',
    NULL,
    NULL,
    'active'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO brand_locations (id, brand_id, name, address) VALUES
  (
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001',
    'SoHo Studio',
    '42 Mercer St, New York, NY'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO brand_staff (id, brand_id, email, role, auth_user_id, invited_at, accepted_at) VALUES
  (
    'a0000000-0000-4000-8000-000000000011',
    'a0000000-0000-4000-8000-000000000001',
    'admin@studioflow.test',
    'admin',
    '11111111-1111-4111-8111-111111111101',
    now() - interval '30 days',
    now() - interval '29 days'
  ),
  (
    'a0000000-0000-4000-8000-000000000012',
    'a0000000-0000-4000-8000-000000000001',
    'scanner@studioflow.test',
    'scanner',
    '11111111-1111-4111-8111-111111111102',
    now() - interval '14 days',
    now() - interval '13 days'
  ),
  (
    'b0000000-0000-4000-8000-000000000011',
    'b0000000-0000-4000-8000-000000000001',
    'admin@rivalgym.test',
    'admin',
    '22222222-2222-4222-8222-222222222201',
    now() - interval '20 days',
    now() - interval '19 days'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO challenges (
  id, brand_id, title, description, habit_type, offer_headline, offer_code,
  status, starts_at, ends_at, completion_rule, max_redemptions, published_at
) VALUES
  (
    'a0000000-0000-4000-8000-000000000021',
    'a0000000-0000-4000-8000-000000000001',
    'Try a class at Studio Flow',
    'Complete one stretch habit and redeem your first class free.',
    'stretch',
    'First class free',
    'CADA-STRETCH',
    'active',
    now() - interval '21 days',
    now() + interval '9 days',
    'single_completion',
    100,
    now() - interval '20 days'
  ),
  (
    'b0000000-0000-4000-8000-000000000021',
    'b0000000-0000-4000-8000-000000000001',
    'Free day pass at Rival Gym',
    'Knock out a gym habit and get a free day pass.',
    'gym',
    'Free day pass',
    NULL,
    'active',
    now() - interval '10 days',
    NULL,
    'single_completion',
    NULL,
    now() - interval '9 days'
  ),
  (
    'c0000000-0000-4000-8000-000000000021',
    'a0000000-0000-4000-8000-000000000001',
    'Morning journal at Studio Flow',
    'Complete a journal habit and unlock a discounted class pack.',
    'journal',
    '20% off class pack',
    'CADA-JOURNAL',
    'pending_review',
    now() + interval '3 days',
    now() + interval '30 days',
    'single_completion',
    50,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

UPDATE challenges
SET submitted_at = now() - interval '2 hours'
WHERE id = 'c0000000-0000-4000-8000-000000000021';

-- Brand A: 8 enrollments (5 completed, 2 active, 1 dropped)
INSERT INTO user_challenge_enrollments (
  id, challenge_id, user_id, status, enrolled_at, completed_at, completion_count
) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000001', 'completed', now() - interval '18 days', now() - interval '17 days', 1),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000002', 'completed', now() - interval '15 days', now() - interval '14 days', 1),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000003', 'completed', now() - interval '12 days', now() - interval '11 days', 1),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000004', 'completed', now() - interval '8 days', now() - interval '7 days', 1),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000005', 'completed', now() - interval '6 days', now() - interval '5 days', 1),
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000006', 'active', now() - interval '3 days', NULL, 0),
  ('e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000007', 'active', now() - interval '2 days', NULL, 0),
  ('e0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000008', 'dropped', now() - interval '10 days', NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- Brand B: cross-brand RLS test data
INSERT INTO user_challenge_enrollments (
  id, challenge_id, user_id, status, enrolled_at, completed_at, completion_count
) VALUES
  ('e0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000001', 'active', now() - interval '4 days', NULL, 0),
  ('e0000000-0000-4000-8000-000000000102', 'b0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000002', 'completed', now() - interval '6 days', now() - interval '5 days', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO habit_completion_events (id, user_id, habit_type, completed_at, source_event_id, enrollment_id) VALUES
  ('h0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'stretch', now() - interval '17 days', 'app-ko-seed-001', 'e0000000-0000-4000-8000-000000000001'),
  ('h0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'stretch', now() - interval '14 days', 'app-ko-seed-002', 'e0000000-0000-4000-8000-000000000002'),
  ('h0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'stretch', now() - interval '11 days', 'app-ko-seed-003', 'e0000000-0000-4000-8000-000000000003'),
  ('h0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 'stretch', now() - interval '7 days', 'app-ko-seed-004', 'e0000000-0000-4000-8000-000000000004'),
  ('h0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005', 'stretch', now() - interval '5 days', 'app-ko-seed-005', 'e0000000-0000-4000-8000-000000000005')
ON CONFLICT (id) DO NOTHING;

INSERT INTO qr_rewards (id, enrollment_id, brand_id, token_hash, status, issued_at, expires_at, redeemed_at) VALUES
  (
    'q0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    encode(digest('dev-token-redeemed-001', 'sha256'), 'hex'),
    'redeemed',
    now() - interval '17 days',
    now() - interval '16 days',
    now() - interval '16 days 4 hours'
  ),
  (
    'q0000000-0000-4000-8000-000000000002',
    'e0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001',
    encode(digest('dev-token-redeemed-002', 'sha256'), 'hex'),
    'redeemed',
    now() - interval '14 days',
    now() - interval '13 days',
    now() - interval '13 days 2 hours'
  ),
  (
    'q0000000-0000-4000-8000-000000000003',
    'e0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000001',
    encode(digest('dev-token-issued-003', 'sha256'), 'hex'),
    'issued',
    now() - interval '11 days',
    now() + interval '13 hours',
    NULL
  ),
  (
    'q0000000-0000-4000-8000-000000000004',
    'e0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000001',
    encode(digest('dev-token-expired-004', 'sha256'), 'hex'),
    'expired',
    now() - interval '8 days',
    now() - interval '7 days',
    NULL
  ),
  (
    'q0000000-0000-4000-8000-000000000005',
    'e0000000-0000-4000-8000-000000000005',
    'a0000000-0000-4000-8000-000000000001',
    encode(digest('dev-token-revoked-005', 'sha256'), 'hex'),
    'revoked',
    now() - interval '5 days',
    now() - interval '4 days',
    NULL
  ),
  (
    'q0000000-0000-4000-8000-000000000101',
    'e0000000-0000-4000-8000-000000000102',
    'b0000000-0000-4000-8000-000000000001',
    encode(digest('dev-token-rival-001', 'sha256'), 'hex'),
    'redeemed',
    now() - interval '5 days',
    now() - interval '4 days',
    now() - interval '4 days'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO redemptions (id, qr_reward_id, brand_id, staff_id, challenge_id, location_id, redeemed_at, metadata) VALUES
  (
    'r0000000-0000-4000-8000-000000000001',
    'q0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000012',
    'a0000000-0000-4000-8000-000000000021',
    'a0000000-0000-4000-8000-000000000002',
    now() - interval '16 days 4 hours',
    '{"user_agent": "seed", "ip_hash": "abc123"}'::jsonb
  ),
  (
    'r0000000-0000-4000-8000-000000000002',
    'q0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000011',
    'a0000000-0000-4000-8000-000000000021',
    'a0000000-0000-4000-8000-000000000002',
    now() - interval '13 days 2 hours',
    '{"user_agent": "seed"}'::jsonb
  ),
  (
    'r0000000-0000-4000-8000-000000000101',
    'q0000000-0000-4000-8000-000000000101',
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000011',
    'b0000000-0000-4000-8000-000000000021',
    NULL,
    now() - interval '4 days',
    '{}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO redemption_attempts (id, token_hash, brand_id, staff_id, outcome, created_at) VALUES
  ('d0000000-0000-4000-8000-000000000001', encode(digest('dev-token-redeemed-001', 'sha256'), 'hex'), 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000012', 'already_redeemed', now() - interval '15 days'),
  ('d0000000-0000-4000-8000-000000000002', encode(digest('bad-token', 'sha256'), 'hex'), 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000012', 'invalid', now() - interval '14 days')
ON CONFLICT (id) DO NOTHING;

COMMIT;
