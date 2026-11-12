// Scoring math: turns per-dimension scores into
//   - Probability of Winning (0-100): "Is this a great company?" (weighted "winning" dimensions)
//   - Joiner Upside (0-100): "Is joining it now a great deal for me?" (valuation headroom + career velocity)
//   - Personal score: what each user's list is ranked by
// Red flags never change scores silently: they are shown, and penalizing them is the user's choice.
// Pure functions, no I/O.
import { DEFAULT_WEIGHTS, JOINER_DIMENSIONS, WINNING_DIMENSIONS } from "./rubric.ts";
import type { Confidence, DimensionKey, DimensionScore, RedFlag, Severity, WinningKey } from "./rubric.ts";

export type Weights = Record<WinningKey, number>;
type Scores = Partial<Record<DimensionKey, DimensionScore>>;

// Low-confidence scores are pulled toward the neutral midpoint (3) so a thinly-researched
// company can't top the rankings on guesses alone. A judgment call worth noting in the brief.
const CONFIDENCE_FACTOR: Record<Confidence, number> = { high: 1, medium: 0.85, low: 0.6 };

// Optional red-flag penalty, applied only if the user turns it on (LTV Module 5: ethics & governance).
export const RED_FLAG_PENALTY: Record<Severity, number> = { high: 10, medium: 4, low: 0 };

export function adjustedScore(s: DimensionScore): number {
  return 3 + (s.score - 3) * CONFIDENCE_FACTOR[s.confidence];
}

function weightedTo100(scores: Scores, keys: { key: DimensionKey; w: number }[]): number {
  let total = 0;
  let wsum = 0;
  for (const { key, w } of keys) {
    const s = scores[key];
    if (!s || w <= 0) continue;
    total += adjustedScore(s) * w;
    wsum += w;
  }
  if (wsum === 0) return 0;
  return ((total / wsum - 1) / 4) * 100;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export function redFlagPenalty(flags: RedFlag[] = []): number {
  return Math.min(30, flags.reduce((a, f) => a + RED_FLAG_PENALTY[f.severity], 0));
}

/** Probability of Winning, 0-100 (no red-flag adjustment; see personalScore). */
export function composite(scores: Scores, weights: Weights = DEFAULT_WEIGHTS): number {
  return r1(
    weightedTo100(
      scores,
      WINNING_DIMENSIONS.map((d) => ({ key: d.key, w: Math.max(0, weights[d.key as WinningKey] ?? 0) })),
    ),
  );
}

/** Joiner Upside, 0-100: is joining at today's price and stage a good deal? */
export function joinerUpside(scores: Scores): number {
  return r1(weightedTo100(scores, JOINER_DIMENSIONS.map((d) => ({ key: d.key, w: d.defaultWeight }))));
}

/** Scale any weight map so it sums to 100 (keeps sliders intuitive). */
export function normalizeWeights(w: Partial<Weights>): Weights {
  const merged = { ...DEFAULT_WEIGHTS, ...w } as Weights;
  const sum = Object.values(merged).reduce((a, b) => a + Math.max(0, b), 0);
  if (sum === 0) return { ...DEFAULT_WEIGHTS };
  return Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [k, Math.round((Math.max(0, v) / sum) * 1000) / 10]),
  ) as Weights;
}

/** Starting points for personal weights; users (and the profile reader) adjust from here. */
export const WEIGHT_PRESETS: Record<string, { label: string; description: string; weights: Weights }> = {
  balanced: { label: "Balanced (LTV default)", description: "The team's default LTV view.", weights: { ...DEFAULT_WEIGHTS } },
  upside_seeker: {
    label: "Upside seeker",
    description: "Wants the next rocketship; tolerates risk for a massive market, momentum and great founders.",
    weights: normalizeWeights({ market: 15, pmf: 10, growth: 15, moat: 10, competition: 10, business_model: 5, gtm: 5, independence: 5, risk_retirement: 0, capital: 5, team: 15, ai_positioning: 5 }),
  },
  safety_first: {
    label: "Safety first",
    description: "Wants proven traction, sound economics, retired risks and a long runway.",
    weights: normalizeWeights({ market: 5, pmf: 20, growth: 5, moat: 10, competition: 10, business_model: 12, gtm: 8, independence: 5, risk_retirement: 10, capital: 10, team: 5, ai_positioning: 0 }),
  },
  builder: {
    label: "Builder / learner",
    description: "Wants great founders, momentum and a hard problem; learning over certainty.",
    weights: normalizeWeights({ market: 10, pmf: 10, growth: 15, moat: 5, competition: 5, business_model: 5, gtm: 10, independence: 5, risk_retirement: 0, capital: 5, team: 20, ai_positioning: 10 }),
  },
};

/**
 * Personal score = blend × company quality (re-weighted with the user's weights)
 *                + (1 − blend) × profile fit (0-100, from the fit model)
 *                − red-flag penalty (only if the user opted in).
 * blend defaults to 0.5 and is a user setting ("winning vs fitting me").
 */
export function personalScore(params: {
  scores: Scores;
  userWeights?: Partial<Weights>;
  redFlags?: RedFlag[];
  penalizeRedFlags?: boolean; // user setting, default off: flags are shown, the joiner decides
  profileFit: number | null; // null = not computed yet
  blend?: number;
}): number {
  const quality = composite(params.scores, normalizeWeights(params.userWeights ?? {}));
  const b = Math.min(1, Math.max(0, params.blend ?? 0.5));
  const base = params.profileFit == null ? quality : b * quality + (1 - b) * params.profileFit;
  const penalty = params.penalizeRedFlags ? redFlagPenalty(params.redFlags ?? []) : 0;
  return r1(Math.max(0, base - penalty));
}
