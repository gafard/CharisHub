import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  '';

/**
 * Supabase admin client (server-side only, bypasses RLS).
 *
 * Null when SUPABASE_SERVICE_ROLE_KEY is not set.
 */
export const supabaseServer: SupabaseClient | null =
  url && serviceKey ? createClient(url, serviceKey) : null;
