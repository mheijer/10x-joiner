// Scoring math: turns per-dimension scores into the composite ("probability of winning")
// and the personal score each user's list is ranked by. Pure functions, no I/O.
import { DEFAULT_WEIGHTS, DIMENSIONS } from "./rubric.ts";
import type { Confidence, DimensionKey, DimensionScore } from "./rubric.ts";

export type Weights = Record<DimensionKey, number>;

// Low-confidence scores are pulled toward the neutral midpoint (3) so a thinly-researched
// company can't top the rankings on guesses alone. This is a judgment call worth noting in the brief.
const CONFIDENCE_FACTOR: Record<Confidence, number> = { high: 1, medium: 0.85, low: 0.6 };

export function adjustedScore(s: DimensionScore): number {
  return 3 + (s.score - 3) * CONFIDENCE_FACTOR[s.confidence];
}

/** Weighted average of 1-5 scores, mapped to 0-100. */
export function composite(
  scores: Partial<Record<DimensionKey, DimensionScore>>,
  weights: Weights = DEFAULT_WEIGHTS,
): number {
  let total = 0;
  let wsum = 0;
  for (const d of DIMENSIONS) {
    const s = scores[d.key];
    const w = Math.max(0, weights[d.key] ?? 0);
    if (!s || w === 0) continue;
    total += adjustedScore(s) * w;
    wsum += w;
  }
  if (wsum === 0) return 0;
  const avg = total / wsum; // 1..5
  return Math.round(((avg - 1) / 4) * 1000) / 10; // 0..100, one decimal
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

/**
 * Personal score = blend × company quality (re-weighted with the user's weights)
 *                + (1 − blend) × profile fit (0-100, from the fit model).
 * blend defaults to 0.5 and is a user setting ("winning vs fitting me").
 */
export function personalScore(params: {
  scores: Partial<Record<DimensionKey, DimensionScore>>;
  userWeights?: Partial<Weights>;
  profileFit: number | null; // null = not computed yet
  blend?: number;
}): number {
  const quality = composite(params.scores, normalizeWeights(params.userWeights ?? {}));
  if (params.profileFit == null) return quality;
  const b = Math.min(1, Math.max(0, params.blend ?? 0.5));
  return Math.round((b * quality + (1 - b) * params.profileFit) * 10) / 10;
}
