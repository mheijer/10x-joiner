// Display helpers shared by the UI. Pure.
export const usd = (x: number | null | undefined): string => {
  if (x == null || !isFinite(x)) return "—";
  if (x >= 1e9) return `$${(x / 1e9).toFixed(x >= 1e10 ? 0 : 1)}B`;
  if (x >= 1e6) return `$${Math.round(x / 1e6)}M`;
  if (x >= 1e3) return `$${Math.round(x / 1e3)}K`;
  return `$${Math.round(x)}`;
};

export const num = (x: number | null | undefined): string => (x == null ? "—" : Math.round(x).toLocaleString("en-US"));

/** 0-100 score → a color on a red-amber-green scale (for pins and badges). */
export function scoreColor(score: number | null | undefined): string {
  if (score == null) return "#9ca3af"; // not evaluated
  if (score >= 75) return "#15803d";
  if (score >= 60) return "#65a30d";
  if (score >= 45) return "#d97706";
  return "#dc2626";
}

/** Winning vs Joiner Upside quadrant (see docs/SCORING_FRAMEWORK.md §1). */
export function quadrant(winning: number | null | undefined, upside: number | null | undefined): string | null {
  if (winning == null || upside == null) return null;
  const hiW = winning >= 60;
  const hiU = upside >= 60;
  if (hiW && hiU) return "Pursue";
  if (hiW && !hiU) return "Blue chip";
  if (!hiW && hiU) return "Lottery ticket";
  return "Pass";
}

export const PHASE_LABEL: Record<string, string> = {
  cvp_fit: "Proving customers love it (CVP fit)",
  gtm_fit: "Proving repeatable sales (GTM fit)",
  bm_fit: "Proving the business model (BM fit)",
  scaling: "Scaling",
};

// ------------------------------------------------------------------ plain-English reading of the scores (panel)

/** A 0-100 score as a word, on the same cut-offs as scoreColor. */
export function band(score: number | null | undefined): string {
  if (score == null) return "Not scored";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Good";
  if (score >= 45) return "Mixed";
  return "Weak";
}

/** A 1-5 grade as a word. */
export function gradeWord(g: number | null | undefined): string {
  if (g == null) return "—";
  if (g >= 4.5) return "Excellent";
  if (g >= 3.5) return "Good";
  if (g >= 2.5) return "Fair";
  if (g >= 1.5) return "Weak";
  return "Poor";
}

/** What each quadrant means for a joiner, in one headline and one line. */
export const QUADRANT_INFO: Record<string, { headline: string; detail: string; color: string }> = {
  Pursue: {
    headline: "Pursue",
    detail: "Likely to win, and still a good deal to join today.",
    color: "#15803d",
  },
  "Blue chip": {
    headline: "Blue chip",
    detail: "Likely to win, but much of the upside is already priced in.",
    color: "#2563eb",
  },
  "Lottery ticket": {
    headline: "Lottery ticket",
    detail: "Big upside for a joiner if it works, but less likely to win.",
    color: "#d97706",
  },
  Pass: {
    headline: "Pass for now",
    detail: "Weaker odds of winning and limited upside for a joiner today.",
    color: "#6b7280",
  },
};

/** First sentence of a rationale, for one-line strengths and watch-outs. */
export function firstSentence(text: string | null | undefined, max = 160): string {
  const t = (text ?? "").trim();
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  const s = m ? m[1] : t;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export interface Highlight {
  key: string;
  grade: number;
  confidence: string;
  line: string;
}

/**
 * Top strengths and watch-outs from the graded dimensions: strengths = grades of 4+ that carry the most points;
 * watch-outs = grades of 2.5 or less (lowest first), else the lowest-graded dimensions if none are that low.
 */
export function strengthsAndWatchouts(
  scores: Record<string, { score: number; confidence: string; rationale: string } | undefined> | null | undefined,
  weights: Record<string, number>,
  n = 3,
): { strengths: Highlight[]; watchouts: Highlight[] } {
  const graded = Object.entries(scores ?? {})
    .filter(([k, s]) => s && k in weights)
    .map(([key, s]) => ({ key, grade: s!.score, confidence: s!.confidence, line: firstSentence(s!.rationale), w: weights[key] ?? 0 }));
  const strengths = graded
    .filter((x) => x.grade >= 4)
    .sort((a, b) => b.grade * b.w - a.grade * a.w)
    .slice(0, n);
  const low = graded.filter((x) => x.grade <= 2.5).sort((a, b) => a.grade - b.grade || b.w - a.w);
  const watchouts = (low.length ? low : [...graded].sort((a, b) => a.grade - b.grade || b.w - a.w))
    .filter((x) => !strengths.some((s) => s.key === x.key))
    .slice(0, n);
  const strip = ({ w, ...rest }: (typeof graded)[number]) => rest;
  return { strengths: strengths.map(strip), watchouts: watchouts.map(strip) };
}
