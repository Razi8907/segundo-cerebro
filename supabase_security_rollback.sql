-- ═══════════════════════════════════════════════════════════
-- ROLLBACK — Restore state if something breaks
-- ═══════════════════════════════════════════════════════════
-- Run this ONLY if the app breaks after enabling RLS.
-- Reverts tables to their pre-security-fix state.
-- Not secure — only use as an emergency recovery step.
-- ═══════════════════════════════════════════════════════════

-- Drop all policies created by the security phases
DROP POLICY IF EXISTS "temp_allow_all_users" ON public.users;
DROP POLICY IF EXISTS "temp_allow_all_dashboard" ON public.dashboard_snapshots;
DROP POLICY IF EXISTS "temp_allow_all_operational" ON public.operational_snapshots;
DROP POLICY IF EXISTS "temp_allow_all_operations" ON public.operations_data;
DROP POLICY IF EXISTS "temp_allow_all_stock" ON public.product_stock;
DROP POLICY IF EXISTS "temp_allow_all_tracking" ON public.daily_tracking;

-- Disable RLS
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_stock DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_tracking') THEN
    EXECUTE 'ALTER TABLE public.daily_tracking DISABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Restore anon/authenticated privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_snapshots TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_snapshots TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operations_data TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_stock TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_tracking') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_tracking TO anon, authenticated';
  END IF;
END $$;
