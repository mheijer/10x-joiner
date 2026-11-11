// Evaluate one company against the LTV rubric (Claude + web search).
import { ask, MODEL } from "./claude.ts";
import { SYSTEM_PROMPT, buildEvaluationPrompt, parseEvaluation } from "./rubric.ts";
import type { CompanyInput, EvaluationResult } from "./rubric.ts";
import { composite } from "./scoring.ts";

export async function evaluateCompany(
  c: CompanyInput,
): Promise<{ result: EvaluationResult; composite: number; model: string }> {
  const prompt = buildEvaluationPrompt(c);
  let lastErr: unknown;
  // One retry if the model returns malformed JSON.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await ask({ system: SYSTEM_PROMPT, prompt, webSearch: true, maxSearches: 6, maxTokens: 5000 });
      const result = parseEvaluation(text);
      return { result, composite: composite(result.scores), model: MODEL };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
