// Personalization: (1) suggest personal weights from a profile, (2) score profile fit per company.
import { ask } from "./claude.ts";
import { DEFAULT_WEIGHTS, WINNING_DIMENSIONS } from "./rubric.ts";
import type { EvaluationResult } from "./rubric.ts";
import { normalizeWeights } from "./scoring.ts";
import type { Weights } from "./scoring.ts";

import type { Preferences } from "./filters.ts";
import type { SalaryBand } from "./hiring.ts";

export interface Profile {
  background_text: string; // resume / cover letter
  looking_for: string;
  preferences?: Preferences; // structured chips; hard filters live in lib/filters.ts
}

const SYSTEM = `You help HBS MBA students decide which startups to join, using LTV course frameworks.
Be concrete and brief. Return only JSON.`;

/** Proposes personal weights (starting from the defaults) with a one-line reason per change. */
export async function suggestWeights(
  p: Profile,
): Promise<{ weights: Weights; reasons: Partial<Record<keyof Weights, string>> }> {
  const dims = WINNING_DIMENSIONS.map((d) => `"${d.key}" (${d.label}): default ${d.defaultWeight}`).join("\n");
  const text = await ask({
    system: SYSTEM,
    prompt: `A student describes themselves and what they want in a startup. Starting from the default weights,
adjust the weights (they will be rescaled to sum to 100). Presets exist: upside_seeker, safety_first, builder; you may start from one to reflect what THIS person cares about.
Change only weights you have a clear reason to change.

Dimensions and defaults:
${dims}

Background:
${p.background_text.slice(0, 6000)}

Looking for:
${p.looking_for}
${p.preferences ? `\nStructured preferences: ${JSON.stringify(p.preferences)}` : ""}

Return JSON: {"weights": {"<key>": number, ...all 10 keys}, "reasons": {"<key>": "one line, only for changed keys"}}`,
    maxTokens: 1500,
  });
  const obj = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return { weights: normalizeWeights({ ...DEFAULT_WEIGHTS, ...(obj.weights ?? {}) }), reasons: obj.reasons ?? {} };
}

/** Profile fit 0-100 for one company, with reasons and a watch-out. */
export async function scoreFit(
  p: Profile,
  company: {
    name: string;
    description?: string | null;
    hq?: string | null;
    headcount?: number | null;
    headcount_growth_pct?: number | null;
    stage?: string | null;
    work_policy?: string | null;
    sponsors_visas?: string | null;
    customer_type?: string[] | null;
    business_type?: string | null;
    joiner_upside?: number | null;
  },
  evaluation: Pick<EvaluationResult, "summary"> | null,
  openRoles: string[],
  openRolesByFunction?: Record<string, number>,
  salaryBands?: SalaryBand[],
): Promise<{ score: number; reasons: string[]; watch_out: string }> {
  const text = await ask({
    system: SYSTEM,
    prompt: `Score how well this company fits this student (0-100). Consider, in order:
1) open roles matching their target functions and seniority, and whether their background is credible for them;
2) stage, size and growth vs what they want (risk appetite, scope, learning);
3) sector, customer type (enterprise vs consumer) and business type they're drawn to, including mission;
4) location, work policy and visa needs;
5) their upside goals vs the company's Joiner Upside, and posted pay vs what they need.
Hiring mostly outside the student's function is NOT a negative: it shows where the company is investing to grow.
Mention it as a datapoint (e.g. "hiring is 60% sales: it's scaling go-to-market"), and suggest direct outreach if
there's no open role in their function.
Hard dealbreakers are filtered separately; here, judge fit among companies that pass.

Student background (excerpt): ${p.background_text.slice(0, 3000)}
Looking for: ${p.looking_for}
Preferences: ${JSON.stringify(p.preferences ?? {})}

Company: ${company.name} — ${company.description ?? ""}
HQ: ${company.hq ?? "unknown"} | Work policy: ${company.work_policy ?? "unknown"} | Visa sponsorship: ${company.sponsors_visas ?? "unknown"}
Headcount: ${company.headcount ?? "unknown"} (12-mo growth: ${company.headcount_growth_pct ?? "unknown"}%) | Stage: ${company.stage ?? "unknown"}
Sells to: ${company.customer_type?.join(", ") ?? "unknown"} | Business type: ${company.business_type ?? "unknown"}
Joiner Upside score: ${company.joiner_upside ?? "n/a"}/100
Analyst summary: ${evaluation?.summary ?? "n/a"}
Open roles by function: ${openRolesByFunction ? JSON.stringify(openRolesByFunction) : "unknown"}
Posted salary ranges: ${salaryBands?.length ? salaryBands.map((b) => `${b.label} $${Math.round(b.min / 1000)}K–$${Math.round(b.max / 1000)}K (${b.postings_with_pay} postings)`).join("; ") : "none posted"}
Open roles (sample): ${openRoles.slice(0, 25).join("; ") || "unknown"}

Return JSON: {"score": number, "reasons": ["2-3 short bullets"], "watch_out": "one short line"}`,
    maxTokens: 600,
  });
  const obj = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return {
    score: Math.min(100, Math.max(0, Number(obj.score) || 0)),
    reasons: Array.isArray(obj.reasons) ? obj.reasons.slice(0, 3) : [],
    watch_out: String(obj.watch_out ?? ""),
  };
}
