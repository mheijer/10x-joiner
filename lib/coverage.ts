// Data coverage: how much we actually know about a company, shown as a caveat badge. Pure.
// High = most grades are medium/high confidence and the key facts are known. Low = treat scores as rough guesses.
import { DIMENSIONS } from "./rubric.ts";

export type Coverage = "high" | "medium" | "low" | "none";

export interface CoverageInput {
  scores?: Record<string, { confidence?: string }> | null;
  latest_post_money_usd?: number | null;
  headcount?: number | null;
  total_funding_usd?: number | null;
  arr_estimate_usd?: number | null;
}

export function coverage(c: CoverageInput): { level: Coverage; reasons: string[] } {
  if (!c.scores || Object.keys(c.scores).length === 0) return { level: "none", reasons: ["Not evaluated yet"] };
  const reasons: string[] = [];
  const conf = DIMENSIONS.map((d) => c.scores?.[d.key]?.confidence).filter(Boolean) as string[];
  const lowShare = conf.filter((x) => x === "low").length / Math.max(1, conf.length);
  let points = 0;
  if (lowShare <= 0.1) points += 2;
  else if (lowShare <= 0.3) points += 1;
  else reasons.push(`${Math.round(lowShare * 100)}% of grades are low-confidence`);
  for (const [k, label] of [
    ["latest_post_money_usd", "valuation"],
    ["arr_estimate_usd", "revenue"],
    ["headcount", "headcount"],
    ["total_funding_usd", "funding"],
  ] as const) {
    if (c[k] != null) points += 0.5;
    else reasons.push(`${label} unknown`);
  }
  const level: Coverage = points >= 3.5 ? "high" : points >= 2 ? "medium" : "low";
  return { level, reasons };
}
