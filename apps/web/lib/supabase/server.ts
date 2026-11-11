import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase access. The service-role key bypasses RLS and must exist
 * only here (never imported into client components). All repository functions
 * therefore MUST scope every query by the authenticated gym_id — see lib/auth.ts.
 */
let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (server only)");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
