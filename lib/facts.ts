// Map an evaluation's facts onto company columns.
// Team decision: the Rocketship List is out of date, so its numbers (headcount, funding) are never used.
// They are kept in companies.list_snapshot for reference only. Identity fields (HQ, founded year) may fall back to it.
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

/**
 * Total funding = the largest credible figure: the model's reported total or the sum of the rounds it found.
 * Cumulative totals only grow, so when sources disagree the larger one is usually the more recent (team rule).
 */
export function bestTotalFunding(f: Facts): number | null {
  const roundsSum = (f.funding_rounds ?? []).reduce((a, r) => a + (r.amount_usd ?? 0), 0);
  const best = Math.max(f.total_funding_usd ?? 0, roundsSum);
  return best > 0 ? best : null;
}

export function factsToCompanyUpdate(f: Facts, existing: CompanyRow = {}) {
  return {
    facts: f,
    facts_as_of: f.as_of ?? null,
    stage: pick(f.stage, existing.stage),
    headcount: f.headcount_estimate ?? null, // never the list's number
    headcount_growth_pct: f.headcount_growth_12m_pct ?? null,
    total_funding_usd: bestTotalFunding(f), // never the list's number
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
    ltv_phase: f.ltv_phase ?? null,
    playbook: f.playbook ?? null,
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
