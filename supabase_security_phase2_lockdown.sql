-- ═══════════════════════════════════════════════════════════
-- PHASE 2 — Lock down: remove permissive policies
-- ═══════════════════════════════════════════════════════════
-- Run this ONLY AFTER confirming the app works correctly
-- with PHASE 1 applied AND the code uses SUPABASE_SERVICE_ROLE_KEY.
--
-- This removes the temporary allow-all policies, so anon and
-- authenticated roles lose access. service_role (used by your
-- API routes) still works because it bypasses RLS.
-- ═══════════════════════════════════════════════════════════

-- Drop temporary permissive policies
DROP POLICY IF EXISTS "temp_allow_all_users" ON public.users;
DROP POLICY IF EXISTS "temp_allow_all_dashboard" ON public.dashboard_snapshots;
DROP POLICY IF EXISTS "temp_allow_all_operational" ON public.operational_snapshots;
DROP POLICY IF EXISTS "temp_allow_all_operations" ON public.operations_data;
DROP POLICY IF EXISTS "temp_allow_all_stock" ON public.product_stock;
DROP POLICY IF EXISTS "temp_allow_all_tracking" ON public.daily_tracking;

-- Drop any old permissive policies from previous iterations
DROP POLICY IF EXISTS "daily_tracking_read" ON public.daily_tracking;
DROP POLICY IF EXISTS "daily_tracking_write" ON public.daily_tracking;

-- Revoke direct table privileges from anon/authenticated
REVOKE ALL ON public.users FROM anon, authenticated;
REVOKE ALL ON public.dashboard_snapshots FROM anon, authenticated;
REVOKE ALL ON public.operational_snapshots FROM anon, authenticated;
REVOKE ALL ON public.operations_data FROM anon, authenticated;
REVOKE ALL ON public.product_stock FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_tracking') THEN
    EXECUTE 'REVOKE ALL ON public.daily_tracking FROM anon, authenticated';
  END IF;
END $$;

-- Verify: should show rowsecurity=true and no policies listed for anon
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
SELECT schemaname, tablename, policyname, roles FROM pg_policies WHERE schemaname='public';
