// Map an evaluation's facts onto company columns. Fresh research wins over the (often stale)
// seed list; the list's original values are kept in companies.list_snapshot for provenance.
import type { Facts } from "./rubric.ts";

export interface CompanyRow {
  stage?: string | null;
  headcount?: number | null;
  total_funding_usd?: number | null;
  hq_city?: string | null;
  founded_year?: number | null;
  [k: string]: unknown;
}

const pick = <T>(fresh: T | null | undefined, old: T | null | undefined): T | null =>
  fresh !== undefined && fresh !== null && !(Array.isArray(fresh) && fresh.length === 0) ? fresh : (old ?? null);

export function factsToCompanyUpdate(f: Facts, existing: CompanyRow = {}) {
  return {
    facts: f,
    facts_as_of: f.as_of ?? null,
    stage: pick(f.stage, existing.stage),
    headcount: pick(f.headcount_estimate, existing.headcount),
    headcount_growth_pct: f.headcount_growth_12m_pct ?? null,
    total_funding_usd: pick(f.total_funding_usd, existing.total_funding_usd),
    latest_post_money_usd: f.latest_post_money_usd ?? null,
    post_money_is_estimate: f.post_money_is_estimate ?? true,
    arr_estimate_usd: f.arr_estimate_usd ?? null,
    hq_city: pick(existing.hq_city, f.hq_city), // keep geocoded list HQ unless missing
    founded_year: pick(existing.founded_year, f.founded_year),
    work_policy: f.work_policy ?? null,
    customer_type: f.customer_type ?? null,
    business_type: f.business_type ?? null,
    gtm_motion: f.gtm_motion ?? null,
    pricing_model: f.pricing_model ?? null,
    sponsors_visas: f.sponsors_visas ?? "unknown",
    careers_url: f.careers_url ?? null,
    ats_provider: f.ats?.provider ?? (existing.ats_provider as string | null) ?? null,
    ats_slug: f.ats?.slug ?? (existing.ats_slug as string | null) ?? null,
  };
}

/** Revenue per employee: a quick capital-efficiency signal (BoldVoice-style). */
export function revenuePerEmployee(arr?: number | null, headcount?: number | null): number | null {
  if (!arr || !headcount) return null;
  return Math.round(arr / headcount);
}
