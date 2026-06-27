import { createClient } from "@supabase/supabase-js";

// Public, client-safe values. The anon/publishable key is meant to ship in the
// browser bundle — Row Level Security (RLS) is what protects the data, not key
// secrecy. Env vars override these when present (see .env / Vite).
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://cibevunbazujwvhqhkro.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_F_BgmwyD3OgkpbRVINvI1A_PfSBA8AK";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
