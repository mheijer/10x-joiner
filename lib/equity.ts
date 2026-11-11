// Equity outcome estimator for a startup offer. Illustrative only, not financial advice.
// Model: grant % today → diluted by future rounds → exit scenarios with a simplified
// 1x non-participating liquidation preference. Taxes are ignored.

export interface ExitScenario {
  label: string; // "Bear" | "Base" | "Bull" ...
  exitValueUsd: number;
  probability: number; // 0-1; normalized across scenarios
}

export interface EquityInputs {
  grantPct: number; // % of fully diluted shares today, e.g. 0.1 for 0.1%
  exerciseCostUsd?: number; // strike × shares (total cost to exercise)
  dilutionPerRound?: number; // e.g. 0.18 for 18%
  roundsToExit?: number;
  preferenceUsd?: number; // total liquidation preference ahead of common (≈ total VC raised, incl. future rounds)
  preferredOwnershipAtExit?: number; // share of company held by preferred at exit, e.g. 0.55
  scenarios: ExitScenario[];
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
  scenarios: ScenarioResult[];
  expectedValueUsd: number;
}

export function estimateEquity(inp: EquityInputs): EquityResult {
  const dilution = clamp(inp.dilutionPerRound ?? 0.18, 0, 0.9);
  const rounds = Math.max(0, Math.round(inp.roundsToExit ?? 2));
  const pref = Math.max(0, inp.preferenceUsd ?? 0);
  const prefOwn = clamp(inp.preferredOwnershipAtExit ?? 0.55, 0, 0.99);
  const exercise = Math.max(0, inp.exerciseCostUsd ?? 0);

  const ownership = (inp.grantPct / 100) * Math.pow(1 - dilution, rounds); // fraction at exit
  const pSum = inp.scenarios.reduce((a, s) => a + Math.max(0, s.probability), 0) || 1;

  const scenarios = inp.scenarios.map((s) => {
    const exit = Math.max(0, s.exitValueUsd);
    // Preferred converts to common when its pro-rata share beats its preference.
    const converts = prefOwn * exit >= pref;
    let gross: number;
    if (converts) {
      gross = ownership * exit;
    } else {
      // Preferred takes its preference first; common splits what's left.
      const residual = Math.max(0, exit - pref);
      gross = (ownership / (1 - prefOwn)) * residual;
    }
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
  return { ownershipAtExitPct: round(ownership * 100, 4), scenarios, expectedValueUsd: Math.round(ev) };
}

/** Sensible default scenarios anchored on the current post-money valuation. */
export function defaultScenarios(postMoneyUsd: number): ExitScenario[] {
  return [
    { label: "Bust", exitValueUsd: 0, probability: 0.35 },
    { label: "Modest", exitValueUsd: postMoneyUsd * 1, probability: 0.3 },
    { label: "Base", exitValueUsd: postMoneyUsd * 3, probability: 0.25 },
    { label: "Rocketship", exitValueUsd: postMoneyUsd * 10, probability: 0.1 },
  ];
}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}
function round(x: number, dp: number) {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}
