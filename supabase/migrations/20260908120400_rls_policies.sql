-- ============================================================================
-- MIGRATION 3: 20260908120400_rls_policies.sql
-- Row-Level Security policies for all core tables
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update own safe profile fields"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND status = (SELECT status FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 2. MEMBERSHIP APPLICATIONS
CREATE POLICY "Anyone can submit a membership application"
  ON public.membership_applications FOR INSERT
  WITH CHECK (status = 'pending' AND reviewed_by IS NULL);

CREATE POLICY "Applicants can view own applications; admins view all"
  ON public.membership_applications FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can update or delete applications"
  ON public.membership_applications FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. EVENTS
CREATE POLICY "Public can view published events; admins view all"
  ON public.events FOR SELECT
  USING (is_published = TRUE OR public.is_admin());

CREATE POLICY "Admins can insert, update, delete events"
  ON public.events FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. EVENT REGISTRATIONS
CREATE POLICY "Active members can view own registrations; admins view all"
  ON public.event_registrations FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Active members can register themselves for events"
  ON public.event_registrations FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_active_member());

CREATE POLICY "Active members can unregister themselves; admins manage all"
  ON public.event_registrations FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can update registration attendance"
  ON public.event_registrations FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. NEWS ARTICLES
CREATE POLICY "Public can view published news; admins view all"
  ON public.news_articles FOR SELECT
  USING (is_published = TRUE OR public.is_admin());

CREATE POLICY "Admins can manage news articles"
  ON public.news_articles FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. GALLERY ITEMS
CREATE POLICY "Public can view gallery items"
  ON public.gallery_items FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can manage gallery items"
  ON public.gallery_items FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7. CONTACT MESSAGES
CREATE POLICY "Anyone can submit a contact message"
  ON public.contact_messages FOR INSERT
  WITH CHECK (status = 'unread' AND handled_by IS NULL);

CREATE POLICY "Admins can view and triage contact messages"
  ON public.contact_messages FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update or delete contact messages"
  ON public.contact_messages FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete contact messages"
  ON public.contact_messages FOR DELETE
  USING (public.is_admin());

-- 8. AUDIT LOGS
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Authenticated users and system can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR actor_id IS NULL);