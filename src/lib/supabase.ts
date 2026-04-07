import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  '';

/** true when both URL and anon key are present. */
export const isSupabaseConfigured = !!(url && key);

/**
 * Supabase client (browser).
 *
 * ⚠️  Null-safe: always check `isSupabaseConfigured` or guard with `if (!supabase)`.
 */
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url, key)
  : (null as unknown as SupabaseClient);
