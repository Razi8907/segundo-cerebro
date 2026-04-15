-- ═══════════════════════════════════════════════════════════
-- PHASE 1 — Enable RLS with temporary permissive policies
-- ═══════════════════════════════════════════════════════════
-- Run this AFTER you've deployed the code change that uses
-- SUPABASE_SERVICE_ROLE_KEY. This enables RLS (so Security
-- Advisor stops complaining) but keeps anon access working
-- temporarily, so if something breaks you can diagnose.
--
-- After you verify the app still works, run phase2 to lock down.
-- ═══════════════════════════════════════════════════════════

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_tracking') THEN
    EXECUTE 'ALTER TABLE public.daily_tracking ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Temporary permissive policies (to avoid breaking anything while testing)
CREATE POLICY "temp_allow_all_users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all_dashboard" ON public.dashboard_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all_operational" ON public.operational_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all_operations" ON public.operations_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all_stock" ON public.product_stock FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_tracking') THEN
    EXECUTE 'CREATE POLICY "temp_allow_all_tracking" ON public.daily_tracking FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Verify
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
