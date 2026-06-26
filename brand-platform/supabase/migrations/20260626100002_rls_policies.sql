-- CADA Brand Platform — Row Level Security
-- Brand isolation, scanner read-only on challenges, app user self-access

-- ---------------------------------------------------------------------------
-- Auth context helpers (used by RLS policies)
-- ---------------------------------------------------------------------------

-- Returns brand staff row for current JWT (auth.uid() = brand_staff.auth_user_id)
CREATE OR REPLACE FUNCTION public.current_brand_staff()
RETURNS TABLE (
  staff_id   UUID,
  brand_id   UUID,
  staff_role brand_staff_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bs.id, bs.brand_id, bs.role
  FROM brand_staff bs
  WHERE bs.auth_user_id = auth.uid()
    AND bs.accepted_at IS NOT NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_brand_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.current_brand_staff());
$$;

CREATE OR REPLACE FUNCTION public.current_brand_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT brand_id FROM public.current_brand_staff();
$$;

CREATE OR REPLACE FUNCTION public.is_brand_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.current_brand_staff() cbs
    WHERE cbs.staff_role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_brand_scanner_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_brand_staff();
$$;

-- CADA app user: auth.uid() matches cada_users.auth_user_id
CREATE OR REPLACE FUNCTION public.current_cada_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cu.id
  FROM cada_users cu
  WHERE cu.auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_cada_app_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_cada_user_id() IS NOT NULL;
$$;

-- Service role / postgres bypass RLS by default in Supabase

-- ---------------------------------------------------------------------------
-- Enable RLS on all tenant-scoped tables
-- ---------------------------------------------------------------------------
ALTER TABLE cada_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenge_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_completion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemption_attempts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- cada_users — app users read own row only
-- ---------------------------------------------------------------------------
CREATE POLICY cada_users_select_own ON cada_users
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Inserts/updates via service role (registration webhook) in Phase 4+

-- ---------------------------------------------------------------------------
-- brands — staff read/update own brand; admin only for update
-- ---------------------------------------------------------------------------
CREATE POLICY brands_select_staff ON brands
  FOR SELECT
  TO authenticated
  USING (id = public.current_brand_id());

CREATE POLICY brands_update_admin ON brands
  FOR UPDATE
  TO authenticated
  USING (id = public.current_brand_id() AND public.is_brand_admin())
  WITH CHECK (id = public.current_brand_id() AND public.is_brand_admin());

-- ---------------------------------------------------------------------------
-- brand_locations
-- ---------------------------------------------------------------------------
CREATE POLICY brand_locations_select_staff ON brand_locations
  FOR SELECT
  TO authenticated
  USING (brand_id = public.current_brand_id());

CREATE POLICY brand_locations_insert_admin ON brand_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (brand_id = public.current_brand_id() AND public.is_brand_admin());

CREATE POLICY brand_locations_update_admin ON brand_locations
  FOR UPDATE
  TO authenticated
  USING (brand_id = public.current_brand_id() AND public.is_brand_admin())
  WITH CHECK (brand_id = public.current_brand_id() AND public.is_brand_admin());

CREATE POLICY brand_locations_delete_admin ON brand_locations
  FOR DELETE
  TO authenticated
  USING (brand_id = public.current_brand_id() AND public.is_brand_admin());

-- ---------------------------------------------------------------------------
-- brand_staff — admin manages; all staff can read roster
-- ---------------------------------------------------------------------------
CREATE POLICY brand_staff_select ON brand_staff
  FOR SELECT
  TO authenticated
  USING (brand_id = public.current_brand_id());

CREATE POLICY brand_staff_insert_admin ON brand_staff
  FOR INSERT
  TO authenticated
  WITH CHECK (brand_id = public.current_brand_id() AND public.is_brand_admin());

CREATE POLICY brand_staff_update_admin ON brand_staff
  FOR UPDATE
  TO authenticated
  USING (brand_id = public.current_brand_id() AND public.is_brand_admin())
  WITH CHECK (brand_id = public.current_brand_id() AND public.is_brand_admin());

-- ---------------------------------------------------------------------------
-- challenges — staff read; admin CRUD; scanner cannot write
-- ---------------------------------------------------------------------------
CREATE POLICY challenges_select_staff ON challenges
  FOR SELECT
  TO authenticated
  USING (brand_id = public.current_brand_id());

CREATE POLICY challenges_insert_admin ON challenges
  FOR INSERT
  TO authenticated
  WITH CHECK (brand_id = public.current_brand_id() AND public.is_brand_admin());

CREATE POLICY challenges_update_admin ON challenges
  FOR UPDATE
  TO authenticated
  USING (brand_id = public.current_brand_id() AND public.is_brand_admin())
  WITH CHECK (brand_id = public.current_brand_id() AND public.is_brand_admin());

CREATE POLICY challenges_delete_admin ON challenges
  FOR DELETE
  TO authenticated
  USING (brand_id = public.current_brand_id() AND public.is_brand_admin());

-- App users: read active challenges only (discovery)
CREATE POLICY challenges_select_active_app_user ON challenges
  FOR SELECT
  TO authenticated
  USING (
    public.is_cada_app_user()
    AND status = 'active'
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );

-- ---------------------------------------------------------------------------
-- user_challenge_enrollments
-- ---------------------------------------------------------------------------
-- Brand staff: aggregate dashboard access for their brand's challenges
CREATE POLICY enrollments_select_staff ON user_challenge_enrollments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM challenges c
      WHERE c.id = user_challenge_enrollments.challenge_id
        AND c.brand_id = public.current_brand_id()
    )
  );

-- App users: own enrollments only
CREATE POLICY enrollments_select_own ON user_challenge_enrollments
  FOR SELECT
  TO authenticated
  USING (user_id = public.current_cada_user_id());

CREATE POLICY enrollments_insert_own ON user_challenge_enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = public.current_cada_user_id());

CREATE POLICY enrollments_update_own ON user_challenge_enrollments
  FOR UPDATE
  TO authenticated
  USING (user_id = public.current_cada_user_id())
  WITH CHECK (user_id = public.current_cada_user_id());

-- ---------------------------------------------------------------------------
-- habit_completion_events
-- ---------------------------------------------------------------------------
CREATE POLICY habit_events_select_staff ON habit_completion_events
  FOR SELECT
  TO authenticated
  USING (
    enrollment_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM user_challenge_enrollments uce
      JOIN challenges c ON c.id = uce.challenge_id
      WHERE uce.id = habit_completion_events.enrollment_id
        AND c.brand_id = public.current_brand_id()
    )
  );

CREATE POLICY habit_events_select_own ON habit_completion_events
  FOR SELECT
  TO authenticated
  USING (user_id = public.current_cada_user_id());

CREATE POLICY habit_events_insert_own ON habit_completion_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = public.current_cada_user_id());

-- ---------------------------------------------------------------------------
-- qr_rewards
-- ---------------------------------------------------------------------------
CREATE POLICY qr_rewards_select_staff ON qr_rewards
  FOR SELECT
  TO authenticated
  USING (brand_id = public.current_brand_id());

-- Scanner + admin need SELECT for redeem validation (API uses service role
-- for atomic redeem; staff JWT can read aggregate counts via this policy)
CREATE POLICY qr_rewards_update_staff_redeem ON qr_rewards
  FOR UPDATE
  TO authenticated
  USING (
    brand_id = public.current_brand_id()
    AND public.is_brand_scanner_or_admin()
  )
  WITH CHECK (brand_id = public.current_brand_id());

CREATE POLICY qr_rewards_select_own ON qr_rewards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_challenge_enrollments uce
      WHERE uce.id = qr_rewards.enrollment_id
        AND uce.user_id = public.current_cada_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- redemptions — brand staff read; scanner can insert (redeem flow)
-- ---------------------------------------------------------------------------
CREATE POLICY redemptions_select_staff ON redemptions
  FOR SELECT
  TO authenticated
  USING (brand_id = public.current_brand_id());

CREATE POLICY redemptions_insert_scanner ON redemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    brand_id = public.current_brand_id()
    AND public.is_brand_scanner_or_admin()
    AND staff_id = (SELECT staff_id FROM public.current_brand_staff())
  );

-- ---------------------------------------------------------------------------
-- redemption_attempts — staff read/write audit for own brand
-- ---------------------------------------------------------------------------
CREATE POLICY redemption_attempts_select_staff ON redemption_attempts
  FOR SELECT
  TO authenticated
  USING (brand_id = public.current_brand_id());

CREATE POLICY redemption_attempts_insert_staff ON redemption_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    brand_id = public.current_brand_id()
    AND public.is_brand_scanner_or_admin()
  );

-- ---------------------------------------------------------------------------
-- Grants for authenticated role (Supabase default)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_brand_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_brand_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_brand_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_brand_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_brand_scanner_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_cada_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_cada_app_user() TO authenticated;
