// Evaluate one company against the LTV rubric (Claude + web search).
import { ask, MODEL } from "./claude.ts";
import { SYSTEM_PROMPT, buildEvaluationPrompt, parseEvaluation } from "./rubric.ts";
import type { CompanyInput, EvaluationResult } from "./rubric.ts";
import { composite } from "./scoring.ts";
import { signalsForPrompt } from "./signals.ts";
import type { Signal } from "./signals.ts";

export async function evaluateCompany(
  c: CompanyInput,
  measuredSignals: Signal[] = [],
): Promise<{ result: EvaluationResult; composite: number; model: string; signals: Signal[] }> {
  const prompt = buildEvaluationPrompt(c, signalsForPrompt(measuredSignals));
  let lastErr: unknown;
  // One retry if the model returns malformed JSON.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await ask({ system: SYSTEM_PROMPT, prompt, webSearch: true, maxSearches: 6, maxTokens: 5000 });
      const result = parseEvaluation(text);
      return { result, composite: composite(result.scores), model: MODEL, signals: measuredSignals };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
