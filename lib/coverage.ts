// Data coverage: how much we actually know about a company, shown as a confidence badge with the reasons. Pure.
// High = most grades are medium/high confidence and the key facts are known. Low = treat scores as rough guesses.
//
// Fairness rules (Nov 17 review): a pre-revenue company's revenue is KNOWN (it's zero), not missing; an undisclosed
// valuation is a common, partial gap when total funding is known (the app estimates from it), not a full one.
import { DIMENSIONS } from "./rubric.ts";

export type Coverage = "high" | "medium" | "low" | "none";

export interface CoverageInput {
  scores?: Record<string, { confidence?: string; rationale?: string }> | null;
  summary?: string | null;
  latest_post_money_usd?: number | null;
  headcount?: number | null;
  total_funding_usd?: number | null;
  arr_estimate_usd?: number | null;
}

const PRE_REVENUE = /pre-revenue|no (disclosed |reported )?revenue|not yet (generating )?revenue|before (any )?revenue|no paying customers/i;

export function isPreRevenue(c: CoverageInput): boolean {
  if (c.arr_estimate_usd === 0) return true;
  return PRE_REVENUE.test(`${c.scores?.pmf?.rationale ?? ""} ${c.summary ?? ""}`);
}

export function coverage(c: CoverageInput): { level: Coverage; reasons: string[]; lowConfidence: string[] } {
  if (!c.scores || Object.keys(c.scores).length === 0) return { level: "none", reasons: ["Not evaluated yet"], lowConfidence: [] };
  const reasons: string[] = [];
  const graded = DIMENSIONS.filter((d) => c.scores?.[d.key]?.confidence);
  const low = graded.filter((d) => c.scores?.[d.key]?.confidence === "low");
  const lowShare = low.length / Math.max(1, graded.length);
  let points = 0;
  if (lowShare <= 0.1) points += 2;
  else if (lowShare <= 0.3) points += 1;
  if (low.length) reasons.push(`${low.length} of ${graded.length} grades are low-confidence: ${low.map((d) => d.label.split(/[,(&]/)[0].trim()).join(", ")}`);

  if (c.latest_post_money_usd != null) points += 0.5;
  else if (c.total_funding_usd != null) {
    points += 0.25;
    reasons.push("valuation not disclosed (estimated from funding)");
  } else reasons.push("valuation unknown");

  if (c.arr_estimate_usd != null || isPreRevenue(c)) points += 0.5;
  else reasons.push("revenue not disclosed");
  if (c.headcount != null) points += 0.5;
  else reasons.push("headcount unknown");
  if (c.total_funding_usd != null) points += 0.5;
  else reasons.push("funding unknown");

  const level: Coverage = points >= 3.25 ? "high" : points >= 2 ? "medium" : "low";
  return { level, reasons, lowConfidence: low.map((d) => d.key) };
}
