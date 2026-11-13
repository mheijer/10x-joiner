// Equity simulator: every assumption behind a startup offer, editable, and what it does to your outcome.
// Builds on lib/equity.ts (financing path, preference stack, exit scenarios). Pure functions, no I/O: browser-safe.
// Illustrative only, not financial or tax advice. Taxes are ignored.
import {
  COMMON_TO_PREFERRED,
  GRANT_MULTIPLE_OF_BASE,
  SCENARIO_TABLE,
  defaultFutureRounds,
  estimateEquity,
  stageBucket,
} from "./equity.ts";
import type { EquityResult, FutureRound, StageBucket } from "./equity.ts";

export type OfferMode = "estimate" | "percent" | "shares";

export interface SimScenario {
  label: string;
  multiple: number; // exit value as a multiple of today's valuation
  probability: number; // percent, 0-100 (normalized if they don't sum to 100)
}

export interface SimState {
  baseSalaryUsd: number;
  offerMode: OfferMode;
  estimateLevel: "low" | "mid" | "high"; // estimate mode: rule-of-thumb grant size
  grantPct: number; // percent mode: % of fully diluted shares, e.g. 0.05
  shares: number; // shares mode
  fullyDilutedShares: number; // shares mode
  strikeUsd: number; // shares mode: exercise price per share (0 for RSUs)
  instrument: "options" | "RSUs";
  postMoneyUsd: number; // today's valuation
  preferenceUsd: number; // liquidation preference ahead of common today ≈ total raised
  rounds: FutureRound[];
  scenarios: SimScenario[];
  yearsStay: number; // 4-year vesting with a 1-year cliff
  preferredOwnershipAtExit: number; // 0-1: share of the company investors hold at exit
}

export interface SimSources {
  valuation: string; // where today's valuation came from
  preference: string;
  base: string;
  bucket: StageBucket;
}

export interface SimCompany {
  name: string;
  stage?: string | null;
  pmfScore?: number | null;
  latest_post_money_usd?: number | null;
  post_money_is_estimate?: boolean | null;
  total_funding_usd?: number | null;
}

/** Starting assumptions for a company, each with its source. Users edit everything from here. */
export function defaultSim(c: SimCompany, base: { usd: number; source: string }): { state: SimState; sources: SimSources } {
  const bucket = stageBucket(c.stage, c.pmfScore);
  let postMoneyUsd = c.latest_post_money_usd ?? 0;
  let valuation = c.latest_post_money_usd
    ? c.post_money_is_estimate
      ? "estimated by our research (no disclosed round)"
      : "latest reported round"
    : "";
  if (!postMoneyUsd && c.total_funding_usd) {
    postMoneyUsd = Math.round(c.total_funding_usd * 5);
    valuation = "rough guess: 5x total raised (no valuation found). Replace it if you know better";
  }
  if (!postMoneyUsd) valuation = "unknown: enter a valuation";
  const preferenceUsd = c.total_funding_usd ?? 0;
  return {
    state: {
      baseSalaryUsd: Math.round(base.usd),
      offerMode: "estimate",
      estimateLevel: "mid",
      grantPct: 0.05,
      shares: 20000,
      fullyDilutedShares: 100_000_000,
      strikeUsd: 1,
      instrument: bucket === "late" ? "RSUs" : "options",
      postMoneyUsd,
      preferenceUsd,
      rounds: defaultFutureRounds(c.stage),
      scenarios: SCENARIO_TABLE[bucket].map((s) => ({ label: s.label, multiple: s.multiple, probability: Math.round(s.probability * 100) })),
      yearsStay: 4,
      preferredOwnershipAtExit: 0.55,
    },
    sources: {
      valuation,
      preference: c.total_funding_usd ? "total raised to date (≈ 1x preference on every round)" : "unknown: no funding data",
      base: base.source,
      bucket,
    },
  };
}

export interface SimResult {
  grantPct: number; // full 4-year grant, % of company today
  vestedFraction: number;
  vestedPct: number; // what you'd own today if you stay yearsStay
  grantValueTodayUsd: number; // full grant × today's valuation (preferred price)
  exerciseCostUsd: number; // for the vested part
  equity: EquityResult; // using the vested stake
  expectedValueUsd: number;
  equityPerYearUsd: number; // expected value ÷ years stayed
  totalCompPerYearUsd: number; // base + equity per year
  breakEvenExitUsd: number | null; // smallest exit at which your stake is worth more than it costs to exercise
}

export function vestedFraction(years: number): number {
  if (years < 1) return 0; // 1-year cliff
  return Math.min(4, years) / 4;
}

export function grantPctFor(s: SimState, bucket: StageBucket): number {
  if (s.offerMode === "percent") return Math.max(0, s.grantPct);
  if (s.offerMode === "shares") return s.fullyDilutedShares > 0 ? (Math.max(0, s.shares) / s.fullyDilutedShares) * 100 : 0;
  if (!s.postMoneyUsd || !s.baseSalaryUsd) return 0;
  return ((GRANT_MULTIPLE_OF_BASE[bucket][s.estimateLevel] * s.baseSalaryUsd) / s.postMoneyUsd) * 100;
}

export function runSim(s: SimState, bucket: StageBucket): SimResult {
  const grantPct = grantPctFor(s, bucket);
  const vf = vestedFraction(s.yearsStay);
  const vestedPct = grantPct * vf;
  const exercise =
    s.instrument === "RSUs"
      ? 0
      : s.offerMode === "shares"
        ? Math.max(0, s.shares) * vf * Math.max(0, s.strikeUsd)
        : (vestedPct / 100) * s.postMoneyUsd * COMMON_TO_PREFERRED[bucket]; // strike ≈ typical 409A share of preferred
  const equity = estimateEquity({
    grantPct: vestedPct,
    exerciseCostUsd: exercise,
    currentPostMoneyUsd: Math.max(0, s.postMoneyUsd),
    currentPreferenceUsd: Math.max(0, s.preferenceUsd),
    futureRounds: s.rounds,
    preferredOwnershipAtExit: s.preferredOwnershipAtExit,
    scenarios: s.scenarios.map((x) => ({ label: x.label, exitValueUsd: Math.max(0, x.multiple) * s.postMoneyUsd, probability: Math.max(0, x.probability) })),
  });
  const years = Math.max(1, Math.min(4, s.yearsStay));
  const perYear = vf > 0 ? equity.expectedValueUsd / years : 0;
  return {
    grantPct,
    vestedFraction: vf,
    vestedPct,
    grantValueTodayUsd: Math.round((grantPct / 100) * s.postMoneyUsd),
    exerciseCostUsd: Math.round(exercise),
    equity,
    expectedValueUsd: equity.expectedValueUsd,
    equityPerYearUsd: Math.round(perYear),
    totalCompPerYearUsd: Math.round(s.baseSalaryUsd + perYear),
    breakEvenExitUsd: breakEven(s, vestedPct, exercise),
  };
}

/** Smallest exit value (searched on a log grid) at which your vested stake beats the cost to exercise it. */
function breakEven(s: SimState, vestedPct: number, exercise: number): number | null {
  if (vestedPct <= 0 || s.postMoneyUsd <= 0) return null;
  for (let m = 0.05; m <= 200; m *= 1.1) {
    const exit = m * s.postMoneyUsd;
    const r = estimateEquity({
      grantPct: vestedPct,
      exerciseCostUsd: exercise,
      currentPostMoneyUsd: s.postMoneyUsd,
      currentPreferenceUsd: s.preferenceUsd,
      futureRounds: s.rounds,
      preferredOwnershipAtExit: s.preferredOwnershipAtExit,
      scenarios: [{ label: "x", exitValueUsd: exit, probability: 1 }],
    });
    if (r.scenarios[0].netValueUsd > 0) return Math.round(exit);
  }
  return null;
}
