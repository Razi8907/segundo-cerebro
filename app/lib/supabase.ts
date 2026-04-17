import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using SERVICE_ROLE key.
 * Creates a fresh client each time to avoid stale key caching.
 */
export function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env vars");
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
