import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

/**
 * Server-side Supabase client using SERVICE_ROLE key.
 * SERVICE_ROLE bypasses RLS and must NEVER be exposed to the browser.
 * Only use this inside API routes (app/api/**), server components, or server actions.
 */
export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer service role (server-only). Fall back to anon key if not configured,
  // but anon access will be denied by RLS policies once enabled.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env vars");
  }
  _supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return _supabase;
}
