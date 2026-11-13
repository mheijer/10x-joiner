// Supabase client with the public anon key. Safe on server and browser: row-level security limits it to the shared
// company list plus the signed-in user's own rows.
import { createClient } from "@supabase/supabase-js";

export function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/(rest\/v1)?\/?$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Columns the Explore and Scatter screens need (one row per company, latest evaluation joined). */
export const EXPLORE_COLUMNS = [
  "id", "name", "domain", "description", "sector", "stage", "headcount", "headcount_growth_pct", "founded_year",
  "hq_city", "lat", "lng", "total_funding_usd", "latest_post_money_usd", "post_money_is_estimate", "arr_estimate_usd",
  "work_policy", "customer_type", "business_type", "sponsors_visas", "ltv_phase", "playbook", "facts_as_of",
  "hiring_profile", "careers_url", "is_seed", "created_at",
  "scores", "composite", "joiner_upside", "red_flags", "summary", "eval_status", "evaluated_at",
].join(",");

export interface CompanyRow {
  id: string;
  name: string;
  domain: string | null;
  description: string | null;
  sector: string | null;
  stage: string | null;
  headcount: number | null;
  headcount_growth_pct: number | null;
  founded_year: number | null;
  hq_city: string | null;
  lat: number | null;
  lng: number | null;
  total_funding_usd: number | null;
  latest_post_money_usd: number | null;
  post_money_is_estimate: boolean | null;
  arr_estimate_usd: number | null;
  work_policy: string | null;
  customer_type: string[] | null;
  business_type: string | null;
  sponsors_visas: string | null;
  ltv_phase: string | null;
  playbook: string | null;
  facts_as_of: string | null;
  hiring_profile: any | null;
  careers_url: string | null;
  is_seed: boolean;
  created_at?: string | null;
  scores: Record<string, { score: number; confidence: string; rationale: string; sources: string[] }> | null;
  composite: number | null;
  joiner_upside: number | null;
  red_flags: { type: string; severity: string; detail: string; source?: string | null }[] | null;
  summary: string | null;
  eval_status: string | null;
  evaluated_at: string | null;
}
