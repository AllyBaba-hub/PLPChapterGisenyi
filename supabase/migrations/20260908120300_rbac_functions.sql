-- ============================================================================
-- MIGRATION 2: 20260908120300_rbac_functions.sql
-- RBAC helper functions, auth profile sync, and member code generator
-- ============================================================================

-- 1. Sequence for Official Digital Membership Card IDs (PLP-GIS-2026-0001)
CREATE SEQUENCE IF NOT EXISTS public.member_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_member_code()
RETURNS TEXT AS $$
DECLARE
  seq_val BIGINT;
  year_str TEXT;
BEGIN
  seq_val := NEXTVAL('public.member_code_seq');
  year_str := TO_CHAR(NOW(), 'YYYY');
  RETURN 'PLP-GIS-' || year_str || '-' || LPAD(seq_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RBAC Role & Status Check Functions (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND role IN ('member', 'admin', 'super_admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND role = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 3. Auto-create Profile when a new Auth User registers
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    'applicant',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 4. Atomic Application Approval RPC (Called by /api/applications/review)
CREATE OR REPLACE FUNCTION public.approve_membership_application(
  p_application_id UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_full_name TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
  END IF;

  SELECT user_id, email, full_name
  INTO v_user_id, v_email, v_full_name
  FROM public.membership_applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  UPDATE public.membership_applications
  SET status = 'approved',
      review_notes = p_review_notes,
      reviewed_by = auth.uid(),
      reviewed_at = NOW()
  WHERE id = p_application_id;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET role = CASE WHEN role = 'applicant' THEN 'member' ELSE role END,
        status = 'active',
        member_code = COALESCE(member_code, public.generate_member_code()),
        joined_at = COALESCE(joined_at, NOW())
    WHERE id = v_user_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    'APPLICATION_APPROVED',
    'application',
    p_application_id::TEXT,
    jsonb_build_object('applicant_email', v_email, 'applicant_name', v_full_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;