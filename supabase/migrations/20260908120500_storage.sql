-- ============================================================================
-- MIGRATION 4: 20260908120500_storage.sql
-- Supabase Storage bucket & policies (compressed photos only; videos use URLs)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chapter-media',
  'chapter-media',
  TRUE,
  524288, -- 512 KB hard cap per image to preserve 1 GB free storage & 5 GB egress
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read access for gallery, event covers, news covers, and avatars
CREATE POLICY "Public read access for chapter-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chapter-media');

-- Admins can upload gallery, event, and news images
CREATE POLICY "Admins can upload chapter-media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chapter-media' AND public.is_admin());

-- Active members can upload their own profile avatar under avatars/{user_id}/
CREATE POLICY "Members can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chapter-media'
    AND public.is_active_member()
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::TEXT
  );

-- Admins can update/delete any chapter media; members can delete own avatar
CREATE POLICY "Admins or avatar owners can delete chapter-media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chapter-media'
    AND (
      public.is_admin()
      OR (
        (storage.foldername(name))[1] = 'avatars'
        AND (storage.foldername(name))[2] = auth.uid()::TEXT
      )
    )
  );