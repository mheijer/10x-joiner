// Hard filters and dealbreakers from a user's stated preferences. Pure functions, no I/O.
// Explore-page filters use the same fields, so "what I told the app" and "what I filter by" stay consistent.
import { stageBucket } from "./equity.ts";
import type { StageBucket } from "./equity.ts";
import type { JobFunction } from "./jobs.ts";

export interface Preferences {
  stage_buckets?: StageBucket[]; // early (Seed/A) | mid (B/C) | late (D+/growth)
  headcount?: [number | null, number | null]; // min, max
  min_headcount_growth_pct?: number | null;
  locations?: string[]; // metros or "City, ST"
  work_policy?: ("onsite" | "hybrid" | "remote")[];
  needs_visa_sponsorship?: boolean;
  sectors?: string[]; // matched against sector text
  customer_types?: ("enterprise" | "mid_market" | "smb" | "consumer" | "government")[];
  business_types?: ("b2b" | "b2c" | "b2b2c" | "marketplace")[];
  target_functions?: JobFunction[]; // roles they want
  require_open_role?: boolean; // only show companies hiring for target functions
  min_total_funding_usd?: number | null;
  risk_appetite?: "upside_seeker" | "balanced" | "safety_first" | "builder";
  hide_red_flags_at?: "medium" | "high" | null; // joiner's choice: hide companies with flags at/above this severity
}

export interface FilterableCompany {
  stage?: string | null;
  headcount?: number | null;
  headcount_growth_pct?: number | null;
  hq_city?: string | null;
  work_policy?: string | null;
  sponsors_visas?: string | null;
  sector?: string | null;
  customer_type?: string[] | null;
  business_type?: string | null;
  total_funding_usd?: number | null;
  open_roles_by_function?: Partial<Record<JobFunction, number>>;
  red_flags?: { severity: "low" | "medium" | "high"; detail: string }[] | null;
}

export interface FilterResult {
  passes: boolean;
  dealbreakers: string[]; // explicit reasons it was excluded
  unknowns: string[]; // preferences we couldn't check (missing data): shown as "unverified", not excluded
}

const overlaps = (a?: string[] | null, b?: string[] | null) => !!a && !!b && a.some((x) => b.includes(x));

export function applyPreferences(c: FilterableCompany, p: Preferences): FilterResult {
  const dealbreakers: string[] = [];
  const unknowns: string[] = [];

  if (p.stage_buckets?.length) {
    if (!c.stage) unknowns.push("stage");
    else if (!p.stage_buckets.includes(stageBucket(c.stage))) dealbreakers.push(`Stage ${c.stage} outside your range`);
  }
  if (p.headcount && (p.headcount[0] != null || p.headcount[1] != null)) {
    const [lo, hi] = p.headcount;
    if (c.headcount == null) unknowns.push("headcount");
    else if ((lo != null && c.headcount < lo) || (hi != null && c.headcount > hi))
      dealbreakers.push(`~${c.headcount} employees outside your size range`);
  }
  if (p.min_headcount_growth_pct != null) {
    if (c.headcount_growth_pct == null) unknowns.push("headcount growth");
    else if (c.headcount_growth_pct < p.min_headcount_growth_pct) dealbreakers.push("Headcount growth below your bar");
  }
  if (p.locations?.length) {
    const remoteOk = p.work_policy?.includes("remote") && c.work_policy === "remote";
    const inMetro = c.hq_city && p.locations.some((l) => c.hq_city!.toLowerCase().includes(l.toLowerCase().split(",")[0]));
    if (!c.hq_city) unknowns.push("location");
    else if (!inMetro && !remoteOk) dealbreakers.push(`HQ in ${c.hq_city}`);
  }
  if (p.work_policy?.length && c.work_policy && c.work_policy !== "unknown" && !p.work_policy.includes(c.work_policy as any))
    dealbreakers.push(`Work policy is ${c.work_policy}`);
  if (p.needs_visa_sponsorship) {
    if (c.sponsors_visas === "no") dealbreakers.push("Doesn't appear to sponsor visas");
    else if (!c.sponsors_visas || c.sponsors_visas === "unknown") unknowns.push("visa sponsorship");
  }
  if (p.sectors?.length && c.sector && !p.sectors.some((s) => c.sector!.toLowerCase().includes(s.toLowerCase())))
    dealbreakers.push(`Sector ${c.sector} not in your list`);
  if (p.customer_types?.length && c.customer_type?.length && !overlaps(p.customer_types, c.customer_type))
    dealbreakers.push("Sells to a different customer type");
  if (p.business_types?.length && c.business_type && !p.business_types.includes(c.business_type as any))
    dealbreakers.push(`${c.business_type.toUpperCase()} business`);
  if (p.min_total_funding_usd != null && c.total_funding_usd != null && c.total_funding_usd < p.min_total_funding_usd)
    dealbreakers.push("Raised less than your minimum");
  if (p.require_open_role && p.target_functions?.length) {
    if (!c.open_roles_by_function) unknowns.push("open roles");
    else if (!p.target_functions.some((f) => (c.open_roles_by_function![f] ?? 0) > 0))
      dealbreakers.push("No open roles in your target functions");
  }
  if (p.hide_red_flags_at && c.red_flags?.length) {
    const rank = { low: 0, medium: 1, high: 2 } as const;
    const worst = c.red_flags.find((f) => rank[f.severity] >= rank[p.hide_red_flags_at!]);
    if (worst) dealbreakers.push(`Red flag: ${worst.detail}`);
  }
  return { passes: dealbreakers.length === 0, dealbreakers, unknowns };
}
