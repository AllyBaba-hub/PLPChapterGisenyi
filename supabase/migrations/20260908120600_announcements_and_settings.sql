-- ============================================================================
-- MIGRATION 5: 20260908120600_announcements_and_settings.sql
-- Internal member announcements, read tracking, and chapter settings
-- ============================================================================

-- 1. Internal Member Announcements (/member/announcements & /admin/settings)
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Per-Member Read Tracking (AnnouncementReadToggle.tsx)
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (announcement_id, user_id)
);

-- 3. Singleton Chapter Settings (/admin/settings & SEO/GEO metadata)
CREATE TABLE IF NOT EXISTS public.chapter_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  chapter_name TEXT NOT NULL DEFAULT 'PLP Chapter Gisenyi',
  parent_organization TEXT NOT NULL DEFAULT 'Peace and Love Proclaimers (PLP)',
  district_location TEXT NOT NULL DEFAULT 'Gisenyi, Rubavu District, Rwanda',
  contact_email TEXT NOT NULL DEFAULT 'gisenyi@plpyouth.org',
  contact_phone TEXT,
  about_summary TEXT NOT NULL DEFAULT 'PLP Chapter Gisenyi is a decentralized district chapter of Peace and Love Proclaimers (PLP), empowering youth in Rubavu District through peacebuilding, unity, reconciliation, and community service.',
  applications_open BOOLEAN NOT NULL DEFAULT TRUE,
  auto_email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default singleton settings row
INSERT INTO public.chapter_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Triggers
DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.chapter_settings;
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON public.chapter_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_settings ENABLE ROW LEVEL SECURITY;

-- Announcements Policies (Active members + admins only)
CREATE POLICY "Active members view published announcements; admins view all"
  ON public.announcements FOR SELECT
  USING ((is_published = TRUE AND public.is_active_member()) OR public.is_admin());

CREATE POLICY "Admins manage announcements"
  ON public.announcements FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Announcement Reads Policies
CREATE POLICY "Members manage own announcement read states"
  ON public.announcement_reads FOR ALL
  USING (user_id = auth.uid() AND public.is_active_member())
  WITH CHECK (user_id = auth.uid() AND public.is_active_member());

-- Chapter Settings Policies (Public read for SEO/footer; admins update)
CREATE POLICY "Anyone can read chapter settings"
  ON public.chapter_settings FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can update chapter settings"
  ON public.chapter_settings FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());