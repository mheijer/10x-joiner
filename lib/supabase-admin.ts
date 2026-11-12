// Server-only Supabase client with the service-role key (bypasses row-level security).
// Use ONLY in scripts and API routes, never in browser code.
import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  // Tolerate common paste mistakes: trailing slash, "/rest/v1", whitespace
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/(rest\/v1)?\/?$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}
