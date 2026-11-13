// Equity outcome estimator for a startup offer. Illustrative only, not financial advice.
// Model: grant % today → future financing rounds (each dilutes you, raises the valuation,
// and adds liquidation preference) → exit scenarios with a simplified 1x non-participating
// preference. Taxes are ignored. Pure functions, no I/O: safe to use in the browser.

export interface ExitScenario {
  label: string; // "Bust" | "Base" | "Rocketship" ...
  exitValueUsd: number;
  probability: number; // relative weights; normalized across scenarios
}

/** One future priced round, as the user assumes it will happen. */
export interface FutureRound {
  name: string; // "Series C"
  stepUp: number; // post-money ÷ previous post-money, e.g. 2 = valuation doubles
  dilution: number; // fraction of the company sold in this round, e.g. 0.15
}

/** One row of the projected financing path (row 0 = today). */
export interface FinancingStep {
  name: string;
  postMoneyUsd: number;
  raiseUsd: number;
  ownershipPct: number; // your % of the company after this round
  paperValueUsd: number; // your % × post-money (what your stake is "worth" on paper)
  preferenceUsd: number; // cumulative liquidation preference ahead of common
}

export interface EquityInputs {
  grantPct: number; // % of fully diluted shares today, e.g. 0.1 for 0.1%
  exerciseCostUsd?: number; // strike × shares (total cost to exercise)
  scenarios: ExitScenario[];
  preferredOwnershipAtExit?: number; // share of company held by preferred at exit, e.g. 0.55

  // Option A (detailed): model each future round explicitly.
  currentPostMoneyUsd?: number;
  currentPreferenceUsd?: number; // ≈ total VC raised to date
  futureRounds?: FutureRound[];

  // Option B (simple): uniform dilution, fixed total preference.
  dilutionPerRound?: number; // e.g. 0.18 for 18%
  roundsToExit?: number;
  preferenceUsd?: number;
}

export interface ScenarioResult {
  label: string;
  probability: number;
  exitValueUsd: number;
  ownershipAtExitPct: number;
  preferredConverted: boolean;
  grossValueUsd: number;
  netValueUsd: number; // after exercise cost, floored at 0 (you wouldn't exercise underwater)
}

export interface EquityResult {
  ownershipAtExitPct: number; // if every projected round happens
  preferenceAtExitUsd: number; // if every projected round happens
  financingPath: FinancingStep[]; // empty in simple mode
  scenarios: ScenarioResult[];
  expectedValueUsd: number;
}

/** Project how your stake, the valuation and the preference stack evolve over future rounds. */
export function projectFinancing(
  grantPct: number,
  currentPostMoneyUsd: number,
  currentPreferenceUsd: number,
  rounds: FutureRound[],
): FinancingStep[] {
  let own = grantPct / 100;
  let post = Math.max(0, currentPostMoneyUsd);
  let pref = Math.max(0, currentPreferenceUsd);
  const path: FinancingStep[] = [
    { name: "Today", postMoneyUsd: post, raiseUsd: 0, ownershipPct: own * 100, paperValueUsd: own * post, preferenceUsd: pref },
  ];
  for (const r of rounds) {
    const d = clamp(r.dilution, 0, 0.9);
    post = post * Math.max(0, r.stepUp);
    const raise = d * post;
    own = own * (1 - d);
    pref += raise;
    path.push({
      name: r.name,
      postMoneyUsd: Math.round(post),
      raiseUsd: Math.round(raise),
      ownershipPct: round(own * 100, 5),
      paperValueUsd: Math.round(own * post),
      preferenceUsd: Math.round(pref),
    });
  }
  return path;
}

export function estimateEquity(inp: EquityInputs): EquityResult {
  const prefOwn = clamp(inp.preferredOwnershipAtExit ?? 0.55, 0, 0.99);
  const exercise = Math.max(0, inp.exerciseCostUsd ?? 0);

  const pSum = inp.scenarios.reduce((a, s) => a + Math.max(0, s.probability), 0) || 1;
  let financingPath: FinancingStep[] = [];

  // Ownership and preference stack a scenario implies.
  // Detailed mode: only rounds priced BELOW the exit value are assumed to happen in that scenario.
  // (A company that exits at today's valuation didn't first raise three up-rounds above it.)
  let stackFor: (exit: number) => { ownership: number; pref: number };
  if (inp.futureRounds && inp.currentPostMoneyUsd != null) {
    financingPath = projectFinancing(inp.grantPct, inp.currentPostMoneyUsd, inp.currentPreferenceUsd ?? 0, inp.futureRounds);
    const path = financingPath;
    stackFor = (exit) => {
      let step = path[0];
      for (const p of path.slice(1)) if (p.postMoneyUsd <= exit) step = p;
      return { ownership: step.ownershipPct / 100, pref: step.preferenceUsd };
    };
  } else {
    const dilution = clamp(inp.dilutionPerRound ?? 0.18, 0, 0.9);
    const rounds = Math.max(0, Math.round(inp.roundsToExit ?? 2));
    const own = (inp.grantPct / 100) * Math.pow(1 - dilution, rounds);
    const pref = Math.max(0, inp.preferenceUsd ?? 0);
    stackFor = () => ({ ownership: own, pref });
  }

  const scenarios = inp.scenarios.map((s) => {
    const exit = Math.max(0, s.exitValueUsd);
    const { ownership, pref } = stackFor(exit);
    // Preferred converts to common when its pro-rata share beats its preference.
    const converts = prefOwn * exit >= pref;
    const gross = converts
      ? ownership * exit
      : (ownership / (1 - prefOwn)) * Math.max(0, exit - pref); // preferred paid first; common splits the rest
    return {
      label: s.label,
      probability: Math.max(0, s.probability) / pSum,
      exitValueUsd: exit,
      ownershipAtExitPct: round(ownership * 100, 4),
      preferredConverted: converts,
      grossValueUsd: Math.round(gross),
      netValueUsd: Math.round(Math.max(0, gross - exercise)),
    };
  });

  const ev = scenarios.reduce((a, s) => a + s.probability * s.netValueUsd, 0);
  const full = stackFor(Number.POSITIVE_INFINITY); // all projected rounds happen
  return {
    ownershipAtExitPct: round(full.ownership * 100, 4),
    preferenceAtExitUsd: Math.round(full.pref),
    financingPath,
    scenarios,
    expectedValueUsd: Math.round(ev),
  };
}

/** Typical remaining rounds by current stage (editable defaults, not predictions). */
export function defaultFutureRounds(stage?: string | null): FutureRound[] {
  const ladder: FutureRound[] = [
    { name: "Series A", stepUp: 3, dilution: 0.2 },
    { name: "Series B", stepUp: 2.5, dilution: 0.15 },
    { name: "Series C", stepUp: 2, dilution: 0.12 },
    { name: "Series D", stepUp: 1.6, dilution: 0.1 },
    { name: "Growth", stepUp: 1.4, dilution: 0.07 },
  ];
  const s = (stage ?? "").toLowerCase();
  const startIdx = s.includes("seed")
    ? 0
    : s.includes("series a")
      ? 1
      : s.includes("series b")
        ? 2
        : s.includes("series c")
          ? 3
          : /series [d-z]\b/.test(s) || s.includes("growth")
            ? 4
            : s.includes("public") || s.includes("acquired")
              ? 5
              : 2; // unknown: assume mid-stage
  return ladder.slice(startIdx, startIdx + 3);
}

export type StageBucket = "early" | "mid" | "late";

export function stageBucket(stage?: string | null, pmfScore?: number | null): StageBucket {
  const s = (stage ?? "").toLowerCase();
  let bucket: StageBucket = /pre-seed|seed|series a\b/.test(s)
    ? "early"
    : /series [d-z]\b|growth|public|acquired|late/.test(s)
      ? "late"
      : "mid"; // Series B/C, or unknown
  // Judge stage by traction, not by the round's name (First Round PMF levels; the "TechCrunch false positive").
  // A pre-revenue Series B carries early-stage risk, so it gets early-stage odds.
  if (pmfScore != null && pmfScore < 2.5) bucket = "early";
  return bucket;
}

// Exit outcomes by stage, as multiples of TODAY's post-money valuation. (Anchoring on today, not on the
// post-money after projected future rounds, avoids double-counting success: those rounds already assume it.)
// Early-stage companies fail more often but have more room to run; late-stage companies are the reverse.
// Expected company-value multiple: early ≈ 2.0x, mid ≈ 2.2x, late ≈ 1.6x. Illustrative defaults; users edit everything.
export const SCENARIO_TABLE: Record<StageBucket, { label: string; multiple: number; probability: number }[]> = {
  early: [
    { label: "Bust", multiple: 0, probability: 0.55 },
    { label: "Modest", multiple: 1, probability: 0.25 },
    { label: "Base", multiple: 4, probability: 0.14 },
    { label: "Rocketship", multiple: 20, probability: 0.06 },
  ],
  mid: [
    { label: "Bust", multiple: 0, probability: 0.3 },
    { label: "Modest", multiple: 1, probability: 0.3 },
    { label: "Base", multiple: 3, probability: 0.3 },
    { label: "Rocketship", multiple: 10, probability: 0.1 },
  ],
  late: [
    { label: "Bust", multiple: 0, probability: 0.1 },
    { label: "Modest", multiple: 0.8, probability: 0.35 },
    { label: "Base", multiple: 2, probability: 0.43 },
    { label: "Rocketship", multiple: 4, probability: 0.12 },
  ],
};

/**
 * Default exit scenarios as multiples of today's post-money, tuned to stage.
 * Pass the company's PMF score (1-5) so stage is judged by traction, not just the round name.
 */
export function defaultScenarios(currentPostMoneyUsd: number, stage?: string | null, pmfScore?: number | null): ExitScenario[] {
  return SCENARIO_TABLE[stageBucket(stage, pmfScore)].map((s) => ({
    label: s.label,
    exitValueUsd: currentPostMoneyUsd * s.multiple,
    probability: s.probability,
  }));
}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}
function round(x: number, dp: number) {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}

// ---------------------------------------------------------------- estimated equity package (no offer yet)
// Rule-of-thumb grant sizes for MBA-level hires (senior IC / first-line manager), expressed as the 4-year
// grant's value at the latest preferred price, as a multiple of base salary. These are rough heuristics for
// orientation only, not market data: users should replace them with a real offer as soon as they have one.
export const GRANT_MULTIPLE_OF_BASE: Record<StageBucket, { low: number; mid: number; high: number }> = {
  early: { low: 1.0, mid: 1.5, high: 2.5 },
  mid: { low: 0.5, mid: 0.9, high: 1.5 },
  late: { low: 0.3, mid: 0.5, high: 0.9 },
};
// Common stock (409A) value as a share of the preferred price: sets the option strike.
// Late-stage companies often grant RSUs instead of options (no exercise cost).
export const COMMON_TO_PREFERRED: Record<StageBucket, number> = { early: 0.3, mid: 0.4, late: 0.6 };

export interface PackageInputs {
  companyName: string;
  stage?: string | null;
  pmfScore?: number | null; // 1-5, so stage is judged by traction
  postMoneyUsd: number; // latest valuation (actual or estimated)
  postMoneyIsEstimate?: boolean;
  totalRaisedUsd?: number | null; // ≈ current liquidation preference
  baseSalaryUsd?: number | null; // from a posted range for the user's role, if any
  baseSalarySource?: string | null; // e.g. "Posted range for Senior PM: $170K–$220K (Ashby)"
  offer?: { grantPct: number; exerciseCostUsd?: number } | null; // real offer overrides the estimate
}

export interface PackageEstimate {
  bucket: StageBucket;
  instrument: "options" | "RSUs (likely)";
  base_salary_usd: number | null;
  grant: { pct_low: number; pct_mid: number; pct_high: number; value_mid_usd: number } | null;
  exercise_cost_usd: number;
  equity: EquityResult | null;
  annualized_mid_usd: number | null; // base + expected equity value / 4 years
  assumptions: string[]; // every assumption, in plain words, so the UI can show them
}

export function estimatePackage(p: PackageInputs): PackageEstimate {
  const bucket = stageBucket(p.stage, p.pmfScore);
  const instrument = bucket === "late" ? "RSUs (likely)" : "options";
  const assumptions: string[] = [
    `Valuation: $${fmtM(p.postMoneyUsd)}${p.postMoneyIsEstimate ? " (estimate)" : ""} for ${p.companyName}.`,
    `Stage treated as ${bucket} (from ${p.stage ?? "unknown stage"}${p.pmfScore != null && p.pmfScore < 2.5 ? ", adjusted for early traction" : ""}).`,
  ];

  let grantPct: number | null = null;
  let grant: PackageEstimate["grant"] = null;
  if (p.offer) {
    grantPct = p.offer.grantPct;
    assumptions.push(`Grant: ${p.offer.grantPct}% from your offer.`);
  } else if (p.baseSalaryUsd) {
    const m = GRANT_MULTIPLE_OF_BASE[bucket];
    const toPct = (mult: number) => round(((mult * p.baseSalaryUsd!) / p.postMoneyUsd) * 100, 5);
    grant = { pct_low: toPct(m.low), pct_mid: toPct(m.mid), pct_high: toPct(m.high), value_mid_usd: Math.round(m.mid * p.baseSalaryUsd) };
    grantPct = grant.pct_mid;
    assumptions.push(
      `Base salary: $${fmtK(p.baseSalaryUsd)}${p.baseSalarySource ? ` (${p.baseSalarySource})` : ""}.`,
      `Grant (estimate): ${m.low}-${m.high}x base over 4 years for a ${bucket}-stage company, midpoint ${m.mid}x. Rule of thumb, not market data: replace with your offer.`,
    );
  } else {
    assumptions.push("No posted salary for your role and no offer entered, so the grant can't be estimated yet.");
  }

  const exercise =
    p.offer?.exerciseCostUsd ??
    (grantPct != null && instrument === "options" ? Math.round((grantPct / 100) * p.postMoneyUsd * COMMON_TO_PREFERRED[bucket]) : 0);
  if (instrument === "options" && grantPct != null && p.offer?.exerciseCostUsd == null)
    assumptions.push(`Exercise cost: strike assumed at ~${Math.round(COMMON_TO_PREFERRED[bucket] * 100)}% of the preferred price (typical 409A).`);

  let equity: EquityResult | null = null;
  if (grantPct != null) {
    const rounds = defaultFutureRounds(p.stage);
    equity = estimateEquity({
      grantPct,
      exerciseCostUsd: exercise,
      currentPostMoneyUsd: p.postMoneyUsd,
      currentPreferenceUsd: p.totalRaisedUsd ?? 0,
      futureRounds: rounds,
      scenarios: defaultScenarios(p.postMoneyUsd, p.stage, p.pmfScore),
    });
    assumptions.push(
      `Future rounds: ${rounds.map((r) => `${r.name} (${Math.round(r.dilution * 100)}% dilution, ${r.stepUp}x step-up)`).join(", ") || "none"}.`,
      `Exit odds and multiples: ${bucket}-stage defaults. Liquidation preference ≈ total raised ($${fmtM(p.totalRaisedUsd ?? 0)}). Taxes ignored.`,
    );
  }

  return {
    bucket,
    instrument,
    base_salary_usd: p.baseSalaryUsd ?? null,
    grant,
    exercise_cost_usd: exercise,
    equity,
    annualized_mid_usd: p.baseSalaryUsd && equity ? Math.round(p.baseSalaryUsd + equity.expectedValueUsd / 4) : null,
    assumptions,
  };
}

function fmtM(x: number) {
  return x >= 1e9 ? `${(x / 1e9).toFixed(1)}B` : `${Math.round(x / 1e6)}M`;
}
function fmtK(x: number) {
  return `${Math.round(x / 1000)}K`;
}
