-- Phase 2: staff invite tokens + brand logo storage

ALTER TABLE brand_staff
  ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_brand_staff_invite_token
  ON brand_staff (invite_token)
  WHERE invite_token IS NOT NULL;

COMMENT ON COLUMN brand_staff.invite_token IS
  'Opaque token for invite acceptance link; cleared after accept.';
COMMENT ON COLUMN brand_staff.invite_expires_at IS
  'Invite link expiry (default 7 days from issue).';

-- Pending invites: no auth_user_id until accepted
ALTER TABLE brand_staff
  ALTER COLUMN auth_user_id DROP NOT NULL;

-- Storage bucket for brand logos (Supabase only; skipped on plain Postgres)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'brand-logos',
      'brand-logos',
      true,
      5242880,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    )
    ON CONFLICT (id) DO NOTHING;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'brand_logos_select'
    ) THEN
      CREATE POLICY brand_logos_select ON storage.objects
        FOR SELECT TO public
        USING (bucket_id = 'brand-logos');

      CREATE POLICY brand_logos_insert_admin ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'brand-logos'
          AND (storage.foldername(name))[1] = public.current_brand_id()::text
          AND public.is_brand_admin()
        );

      CREATE POLICY brand_logos_update_admin ON storage.objects
        FOR UPDATE TO authenticated
        USING (
          bucket_id = 'brand-logos'
          AND (storage.foldername(name))[1] = public.current_brand_id()::text
          AND public.is_brand_admin()
        );

      CREATE POLICY brand_logos_delete_admin ON storage.objects
        FOR DELETE TO authenticated
        USING (
          bucket_id = 'brand-logos'
          AND (storage.foldername(name))[1] = public.current_brand_id()::text
          AND public.is_brand_admin()
        );
    END IF;
  END IF;
END $$;
