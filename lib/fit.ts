// Personalization: (1) suggest personal weights from a profile, (2) score profile fit per company.
import { ask } from "./claude.ts";
import { DEFAULT_WEIGHTS, DIMENSIONS } from "./rubric.ts";
import type { EvaluationResult } from "./rubric.ts";
import { normalizeWeights } from "./scoring.ts";
import type { Weights } from "./scoring.ts";

export interface Profile {
  background_text: string; // resume / cover letter
  looking_for: string;
  preferences?: {
    stages?: string[];
    headcount?: [number, number];
    sectors?: string[];
    locations?: string[];
    remote_ok?: boolean;
    target_function?: string; // e.g. "Product", "BizOps", "GTM", "Chief of Staff"
  };
}

const SYSTEM = `You help HBS MBA students decide which startups to join, using LTV course frameworks.
Be concrete and brief. Return only JSON.`;

/** Proposes personal weights (starting from the defaults) with a one-line reason per change. */
export async function suggestWeights(
  p: Profile,
): Promise<{ weights: Weights; reasons: Partial<Record<keyof Weights, string>> }> {
  const dims = DIMENSIONS.map((d) => `"${d.key}" (${d.label}): default ${d.defaultWeight}`).join("\n");
  const text = await ask({
    system: SYSTEM,
    prompt: `A student describes themselves and what they want in a startup. Starting from the default weights,
adjust the weights (they will be rescaled to sum to 100) to reflect what THIS person cares about.
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
  company: { name: string; description?: string | null; hq?: string | null; headcount?: number | null; stage?: string | null },
  evaluation: Pick<EvaluationResult, "summary"> | null,
  openRoles: string[],
): Promise<{ score: number; reasons: string[]; watch_out: string }> {
  const text = await ask({
    system: SYSTEM,
    prompt: `Score how well this company fits this student (0-100). Consider: open roles matching their target function,
stage and size match, sector interest, location, and their learning/brand/upside goals. Penalize explicit dealbreakers heavily.

Student background (excerpt): ${p.background_text.slice(0, 3000)}
Looking for: ${p.looking_for}
Preferences: ${JSON.stringify(p.preferences ?? {})}

Company: ${company.name} — ${company.description ?? ""}
HQ: ${company.hq ?? "unknown"} | Headcount: ${company.headcount ?? "unknown"} | Stage: ${company.stage ?? "unknown"}
Analyst summary: ${evaluation?.summary ?? "n/a"}
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
