// Personalization with the AI used sparingly (server-only):
//   1. parseProfile: ONE call per user (re-run only when they edit their profile). Turns a résumé, cover
//      letter and free-text goals into structured preferences + suggested weights. Fit across all companies is then
//      computed for free with plain math (lib/fitmath.ts).
//   2. explainFit: ONE Sonnet call per company the user actually opens, cached in fit_scores. Writes the
//      "why this fits you" explanation on top of the math breakdown.
import { ask, askForTool } from "./claude.ts";
import { DEFAULT_WEIGHTS, WINNING_DIMENSIONS } from "./rubric.ts";
import { normalizeWeights, WEIGHT_PRESETS } from "./scoring.ts";
import type { Weights } from "./scoring.ts";
import type { Preferences } from "./filters.ts";
import type { HiringProfile } from "./hiring.ts";
import type { FitResult } from "./fitmath.ts";

export interface Profile {
  background_text: string; // résumé / cover letter text (we store text only, never the file)
  looking_for: string;
  preferences?: Preferences; // anything the user set explicitly; wins over what the AI infers
}

export interface ParsedProfile {
  preferences: Preferences; // inferred, merged with explicit choices
  preset: keyof typeof WEIGHT_PRESETS;
  weights: Weights;
  weight_reasons: Partial<Record<keyof Weights, string>>;
  summary: string; // one line: who this person is and what they want
}

const SYSTEM = `You help HBS MBA students decide which startups to join, using LTV course frameworks.
Be concrete and brief. Never invent facts about the person. Return only JSON.`;

const FUNCTIONS = "product | bizops | chief_of_staff | gtm | fde | marketing | engineering";

const PROFILE_TOOL = {
  name: "submit_profile",
  description: "Submit the student's structured job-search preferences and suggested weights.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One line: who they are and what they want" },
      preferences: {
        type: "object",
        properties: {
          target_functions: { type: "array", items: { type: "string", enum: ["product", "bizops", "chief_of_staff", "gtm", "fde", "marketing", "engineering"] } },
          stage_buckets: { type: "array", items: { type: "string", enum: ["early", "mid", "late"] } },
          headcount: { type: "array", items: { type: ["number", "null"] }, description: "[min, max]" },
          locations: { type: "array", items: { type: "string" }, description: "Metros as 'City, ST'" },
          work_policy: { type: "array", items: { type: "string", enum: ["onsite", "hybrid", "remote"] } },
          needs_visa_sponsorship: { type: ["boolean", "null"] },
          sectors: { type: "array", items: { type: "string" } },
          interests: { type: "array", items: { type: "string" }, description: "Short keywords, e.g. healthcare, AI agents, fintech" },
          customer_types: { type: "array", items: { type: "string", enum: ["enterprise", "mid_market", "smb", "consumer", "government"] } },
          min_base_salary_usd: { type: ["number", "null"] },
        },
      },
      preset: { type: "string", enum: ["balanced", "upside_seeker", "safety_first", "builder"] },
      weights: {
        type: "object",
        properties: Object.fromEntries(WINNING_DIMENSIONS.map((d) => [d.key, { type: "number" }])),
        required: WINNING_DIMENSIONS.map((d) => d.key),
      },
      weight_reasons: {
        type: "object",
        description: "Only for weights you changed from the default: one line citing what they said",
        additionalProperties: { type: "string" },
      },
    },
    required: ["summary", "preferences", "preset", "weights", "weight_reasons"],
  },
};

export async function parseProfile(p: Profile): Promise<ParsedProfile> {
  const dims = WINNING_DIMENSIONS.map((d) => `"${d.key}" (${d.label}): default ${d.defaultWeight}`).join("\n");
  // Structured output via a tool call (validated by the API), not free-text JSON.
  const obj = await askForTool<any>({
    system: SYSTEM,
    tool: PROFILE_TOOL,
    maxTokens: 2000,
    prompt: `Read this student's background and goals. Extract their job-search preferences and suggest how to weight
the company-evaluation dimensions for THEM. Only fill a preference if the text supports it; otherwise leave it out.
Target functions: ${FUNCTIONS}.

Background (résumé / cover letter):
${p.background_text.slice(0, 8000) || "(none provided)"}

What they're looking for:
${p.looking_for || "(none provided)"}

Weight dimensions and defaults (rescaled to sum to 100; change only with a clear reason from their text):
${dims}
Presets you may start from: balanced, upside_seeker (massive market, momentum, founders), safety_first (proven traction,
economics, retired risks, runway), builder (great founders, momentum, hard problems).

Submit by calling submit_profile.`,
  });
  const preset = (obj.preset in WEIGHT_PRESETS ? obj.preset : "balanced") as keyof typeof WEIGHT_PRESETS;
  return {
    summary: String(obj.summary ?? ""),
    // Anything the user chose explicitly overrides what the AI inferred
    preferences: { ...(obj.preferences ?? {}), ...(p.preferences ?? {}) },
    preset,
    weights: normalizeWeights({ ...DEFAULT_WEIGHTS, ...(obj.weights ?? {}) }),
    weight_reasons: obj.weight_reasons ?? {},
  };
}

/** "Why this fits you", written on demand for a company the user opens. The score itself comes from the math. */
export async function explainFit(
  profile: Profile & { summary?: string },
  company: { name: string; description?: string | null; summary?: string | null },
  fit: FitResult,
  hiring: HiringProfile | null,
): Promise<{ reasons: string[]; watch_out: string; outreach_angle: string }> {
  const text = await ask({
    system: SYSTEM,
    prompt: `Explain in plain words why ${company.name} does or doesn't fit this student. The fit score (${fit.score}/100) is already
computed; don't change it. Ground each point in the breakdown, the company facts and their background.
Hiring mostly outside their function is NOT a negative: it shows where the company is growing.

Student: ${profile.summary ?? ""}
Background (excerpt): ${profile.background_text.slice(0, 3000)}
Looking for: ${profile.looking_for}

Company: ${company.name}: ${company.description ?? ""}
Analyst summary: ${company.summary ?? "n/a"}
Fit breakdown: ${fit.items.map((i) => `${i.factor} ${i.points}/${i.max} (${i.reason})`).join("; ")}
Hiring: ${hiring ? `${hiring.total_open} open; ${hiring.by_function.map((b) => `${b.label} ${b.count}`).join(", ")}${hiring.focus ? `; focus: ${hiring.focus.read}` : ""}` : "no job board found"}

Return JSON: {"reasons": ["2-3 short bullets"], "watch_out": "one short line", "outreach_angle": "one line: how they'd pitch themselves to this company"}`,
    maxTokens: 600,
  });
  const obj = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return {
    reasons: Array.isArray(obj.reasons) ? obj.reasons.slice(0, 3).map(String) : [],
    watch_out: String(obj.watch_out ?? ""),
    outreach_angle: String(obj.outreach_angle ?? ""),
  };
}
