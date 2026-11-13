// Personalization on the client, with plain math (no AI calls): the user's profile state, their personal score per
// company, and which metric the list and map should show. Pure functions, no I/O. Safe in the browser.
//
// The team's LTV default weights are always the baseline. A user's own weights are used only after they choose to
// apply them ("Apply suggested weights", a preset, or moving a slider), and "Reset to default" brings the defaults back.
import { DEFAULT_WEIGHTS } from "./rubric.ts";
import { composite, normalizeWeights, personalScore } from "./scoring.ts";
import type { Weights } from "./scoring.ts";
import { computeFit } from "./fitmath.ts";
import type { FitResult } from "./fitmath.ts";
import type { Preferences } from "./filters.ts";
import type { HiringProfile } from "./hiring.ts";
import { estimatePackage } from "./equity.ts";
import type { PackageEstimate } from "./equity.ts";

export type WeightsSource = "default" | "suggested" | "custom";
export type RedFlagMode = "show" | "penalize" | "hide";

export interface ParsedProfileLite {
  summary: string;
  preset: string;
  preferences: Preferences;
  weights: Weights;
  weight_reasons: Partial<Record<keyof Weights, string>>;
}

export interface ProfileState {
  background_text: string;
  looking_for: string;
  preferences: Preferences; // explicit choices (chips): always win over what the AI inferred
  parsed: ParsedProfileLite | null; // AI reading of the résumé + goals (suggestions only)
  weights: Weights; // the weights in use
  weights_source: WeightsSource;
  blend: number; // 1 = only company quality, 0 = only fit to me
  red_flag_mode: RedFlagMode;
}

export const EMPTY_PROFILE: ProfileState = {
  background_text: "",
  looking_for: "",
  preferences: {},
  parsed: null,
  weights: { ...DEFAULT_WEIGHTS },
  weights_source: "default",
  blend: 0.5,
  red_flag_mode: "show",
};

/**
 * The preferences fit is computed from: AI-inferred ones, overridden by anything the user set explicitly
 * (including clearing a list: an explicit empty list wins, so a user can deselect what the AI inferred).
 */
export function effectivePreferences(p: ProfileState): Preferences {
  const merged: Preferences = { ...(p.parsed?.preferences ?? {}) };
  for (const [k, v] of Object.entries(p.preferences ?? {})) {
    if (v != null && v !== "") (merged as any)[k] = v;
  }
  return merged;
}

/** True once the user has told us anything that can change their ranking. */
export function isPersonalized(p: ProfileState): boolean {
  const prefs = effectivePreferences(p);
  const anyPref = Object.values(prefs).some((v) => v != null && v !== false && !(Array.isArray(v) && v.length === 0));
  return anyPref || p.weights_source !== "default" || p.red_flag_mode !== "show";
}

/** The weights to score with: the team defaults unless the user chose otherwise. */
export function activeWeights(p: ProfileState): Weights {
  return p.weights_source === "default" ? { ...DEFAULT_WEIGHTS } : normalizeWeights(p.weights);
}

export interface ScorableCompany {
  name: string;
  sector?: string | null;
  description?: string | null;
  stage?: string | null;
  headcount?: number | null;
  headcount_growth_pct?: number | null;
  hq_city?: string | null;
  work_policy?: string | null;
  customer_type?: string[] | null;
  business_type?: string | null;
  hiring_profile?: HiringProfile | null;
  scores?: Record<string, any> | null;
  red_flags?: { type?: string; severity: string; detail: string }[] | null;
  composite?: number | null;
}

export interface Personal {
  fit: FitResult; // 0-100, every point traced to a preference
  winning: number | null; // Probability of Winning under the active weights (= team score when on defaults)
  personal: number | null; // what "For you" ranks by; null if not evaluated
}

export function personalFor(c: ScorableCompany, p: ProfileState): Personal {
  const fit = computeFit(
    {
      name: c.name,
      sector: c.sector,
      description: c.description,
      stage: c.stage,
      pmf_score: c.scores?.pmf?.score ?? null,
      headcount: c.headcount,
      headcount_growth_pct: c.headcount_growth_pct,
      hq_city: c.hq_city,
      work_policy: c.work_policy,
      customer_type: c.customer_type,
      business_type: c.business_type,
      hiring: c.hiring_profile && c.hiring_profile.total_open > 0 ? c.hiring_profile : null,
    },
    effectivePreferences(p),
  );
  const evaluated = c.composite != null && c.scores && Object.keys(c.scores).length > 0;
  if (!evaluated) return { fit, winning: null, personal: null };
  const weights = activeWeights(p);
  const winning = p.weights_source === "default" ? (c.composite as number) : composite(c.scores as any, weights);
  const personal = personalScore({
    scores: c.scores as any,
    userWeights: weights,
    redFlags: (c.red_flags ?? []) as any,
    penalizeRedFlags: p.red_flag_mode === "penalize",
    profileFit: isPersonalized(p) ? fit.score : null,
    blend: p.blend,
  });
  return { fit, winning, personal };
}

// ------------------------------------------------------------------ which number the list pill and map pins show
export type Metric = "composite" | "joiner_upside" | "personal";

export const METRIC_LABEL: Record<Metric, string> = {
  composite: "Probability of Winning",
  joiner_upside: "Joiner Upside",
  personal: "For you",
};

export const METRIC_SHORT: Record<Metric, string> = { composite: "Win", joiner_upside: "Upside", personal: "For you" };

/**
 * The metric on display follows what the user is ranking or filtering by: a score sort wins; otherwise the
 * score slider they moved last; otherwise "For you" when personalized, else Probability of Winning.
 */
export function shownMetric(opts: {
  sort: string;
  lastScoreFilter: Metric | null;
  personalized: boolean;
}): Metric {
  if (opts.sort === "composite" || opts.sort === "joiner_upside" || opts.sort === "personal") return opts.sort;
  if (opts.lastScoreFilter) return opts.lastScoreFilter;
  return opts.personalized ? "personal" : "composite";
}

export function metricValue(
  c: { composite?: number | null; joiner_upside?: number | null },
  metric: Metric,
  personal?: Personal | null,
): number | null {
  if (metric === "joiner_upside") return c.joiner_upside ?? null;
  if (metric === "personal") return personal?.personal ?? null;
  return personal?.winning ?? c.composite ?? null;
}

// ------------------------------------------------------------------ first equity estimate (Joiner Upside panel)
/** Typical MBA-hire base when nothing better is known. An assumption, always labeled as one in the UI. */
export const ASSUMED_BASE_USD = 175_000;

/**
 * Which base salary to estimate the grant from, best source first: what the user typed, the posted pay band for
 * their target function, their stated minimum, any posted band at the company, then a labeled assumption.
 */
export function baseSalaryFor(
  hiring: HiringProfile | null | undefined,
  prefs: Preferences,
  override?: number | null,
): { usd: number; source: string; isAssumption: boolean } {
  if (override && override > 0) return { usd: override, source: "you entered it", isAssumption: false };
  const bands = hiring?.salary_bands ?? [];
  const targets = prefs.target_functions ?? [];
  const mine = bands.find((b) => targets.includes(b.function));
  if (mine) return { usd: mine.median_mid, source: `median posted ${mine.label} pay at this company (${mine.postings_with_pay} postings)`, isAssumption: false };
  if (prefs.min_base_salary_usd) return { usd: prefs.min_base_salary_usd, source: "your minimum base from your profile", isAssumption: true };
  if (bands.length) {
    const b = [...bands].sort((x, y) => y.postings_with_pay - x.postings_with_pay)[0];
    return { usd: b.median_mid, source: `median posted ${b.label} pay at this company (not your function)`, isAssumption: true };
  }
  return { usd: ASSUMED_BASE_USD, source: "assumed typical MBA base (no posted pay found)", isAssumption: true };
}

export function firstEquityEstimate(
  c: {
    name: string;
    stage?: string | null;
    scores?: Record<string, any> | null;
    latest_post_money_usd?: number | null;
    post_money_is_estimate?: boolean | null;
    total_funding_usd?: number | null;
    hiring_profile?: HiringProfile | null;
  },
  prefs: Preferences,
  baseOverride?: number | null,
): { estimate: PackageEstimate; base: ReturnType<typeof baseSalaryFor> } | null {
  if (!c.latest_post_money_usd || c.latest_post_money_usd <= 0) return null;
  const base = baseSalaryFor(c.hiring_profile, prefs, baseOverride);
  const estimate = estimatePackage({
    companyName: c.name,
    stage: c.stage,
    pmfScore: c.scores?.pmf?.score ?? null,
    postMoneyUsd: c.latest_post_money_usd,
    postMoneyIsEstimate: !!c.post_money_is_estimate,
    totalRaisedUsd: c.total_funding_usd ?? 0,
    baseSalaryUsd: base.usd,
    baseSalarySource: base.source,
  });
  return { estimate, base };
}
