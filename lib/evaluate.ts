// Evaluate one company against the LTV rubric (Claude + web search).
// The model researches with web search, then submits through the submit_evaluation tool (schema-validated JSON).
// No automatic retry: a full retry repeats every web search and doubles the cost (lesson from the first test batch).
import { askForTool, MODEL } from "./claude.ts";
import { SYSTEM_PROMPT, EVALUATION_TOOL, buildEvaluationPrompt, normalizeEvaluation } from "./rubric.ts";
import type { CompanyInput, EvaluationResult } from "./rubric.ts";
import { composite } from "./scoring.ts";
import { signalsForPrompt } from "./signals.ts";
import type { Signal } from "./signals.ts";

export const MAX_SEARCHES = 5;

export async function evaluateCompany(
  c: CompanyInput,
  measuredSignals: Signal[] = [],
): Promise<{ result: EvaluationResult; composite: number; model: string; signals: Signal[] }> {
  const prompt = buildEvaluationPrompt(c, signalsForPrompt(measuredSignals));
  const raw = await askForTool({
    system: SYSTEM_PROMPT,
    prompt,
    tool: EVALUATION_TOOL,
    webSearch: true,
    maxSearches: MAX_SEARCHES,
    maxTokens: 8000,
  });
  const result = normalizeEvaluation(raw);
  return { result, composite: composite(result.scores), model: MODEL, signals: measuredSignals };
}
