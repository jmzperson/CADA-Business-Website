-- Local / CI auth stub when Supabase auth schema is not present.
-- On hosted Supabase, auth.uid() already exists — this block is skipped.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    CREATE SCHEMA IF NOT EXISTS auth;

    EXECUTE $fn$
      CREATE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $body$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $body$;
    $fn$;
  END IF;
END $$;

DO $$
BEGIN
  CREATE ROLE authenticated;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT authenticated TO postgres;
