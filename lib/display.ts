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
