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
  ownershipAtExitPct: number;
  preferenceAtExitUsd: number;
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

  let ownership: number; // fraction at exit
  let pref: number;
  let financingPath: FinancingStep[] = [];

  if (inp.futureRounds && inp.currentPostMoneyUsd != null) {
    financingPath = projectFinancing(inp.grantPct, inp.currentPostMoneyUsd, inp.currentPreferenceUsd ?? 0, inp.futureRounds);
    const last = financingPath[financingPath.length - 1];
    ownership = last.ownershipPct / 100;
    pref = last.preferenceUsd;
  } else {
    const dilution = clamp(inp.dilutionPerRound ?? 0.18, 0, 0.9);
    const rounds = Math.max(0, Math.round(inp.roundsToExit ?? 2));
    ownership = (inp.grantPct / 100) * Math.pow(1 - dilution, rounds);
    pref = Math.max(0, inp.preferenceUsd ?? 0);
  }

  const pSum = inp.scenarios.reduce((a, s) => a + Math.max(0, s.probability), 0) || 1;
  const scenarios = inp.scenarios.map((s) => {
    const exit = Math.max(0, s.exitValueUsd);
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
  return {
    ownershipAtExitPct: round(ownership * 100, 4),
    preferenceAtExitUsd: Math.round(pref),
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
const SCENARIO_TABLE: Record<StageBucket, { label: string; multiple: number; probability: number }[]> = {
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
