// Batch evaluation (server-only): the same LTV evaluation as lib/evaluate.ts, run through the Message Batches API at
// 50% of standard token prices. Docs: platform.claude.com/docs/en/build-with-claude/batch-processing
//
// Same prompt, model, web-search limit and structured output (submit_evaluation) as the synchronous path. The
// synchronous loop nudges the model to submit if it stops without doing so; a batch has no live connection, so that
// becomes rounds: round 1 = every company; round 2+ = only companies whose turn paused or ended without a submission,
// continued exactly as the synchronous loop would (paused → continue; ended → ask to submit, forced on the last round).
import Anthropic from "@anthropic-ai/sdk";
import { MODEL, PRICES, WEB_SEARCH_USD, WEB_SEARCH_TYPE, usage } from "./claude.ts";
import { SYSTEM_PROMPT, EVALUATION_TOOL, buildEvaluationPrompt, normalizeEvaluation } from "./rubric.ts";
import type { CompanyInput, EvaluationResult } from "./rubric.ts";
import { composite } from "./scoring.ts";
import { signalsForPrompt } from "./signals.ts";
import type { Signal } from "./signals.ts";
import { MAX_SEARCHES } from "./evaluate.ts";

export const BATCH_DISCOUNT = 0.5; // tokens; web-search fees are counted at full price (conservative)
const MAX_ROUNDS = 3;
const POLL_MS = 30_000;

export interface BatchItem {
  id: string; // custom_id: the company's uuid
  input: CompanyInput;
  signals: Signal[];
}
export interface BatchOutcome {
  id: string;
  ok: boolean;
  out?: { result: EvaluationResult; composite: number; model: string; signals: Signal[] };
  error?: string;
}

/** Cost of one response at batch prices (same formula as the synchronous meter, tokens halved). */
export function batchCostUsd(model: string, u: any): number {
  const p = PRICES[model] ?? PRICES["claude-opus-5-5"];
  const input = (u?.input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0) * 1.25 + (u?.cache_read_input_tokens ?? 0) * 0.1;
  const searches = u?.server_tool_use?.web_search_requests ?? 0;
  return ((input * p.input + (u?.output_tokens ?? 0) * p.output) / 1e6) * BATCH_DISCOUNT + searches * WEB_SEARCH_USD;
}

function meterBatch(model: string, u: any) {
  usage.calls++;
  usage.inputTokens += u?.input_tokens ?? 0;
  usage.outputTokens += u?.output_tokens ?? 0;
  usage.webSearches += u?.server_tool_use?.web_search_requests ?? 0;
  usage.costUsd += batchCostUsd(model, u);
}

/** The params for one company's request in a given round. Pure. */
export function requestParams(messages: any[], model: string, force: boolean) {
  const submit = { name: EVALUATION_TOOL.name, description: EVALUATION_TOOL.description, input_schema: EVALUATION_TOOL.input_schema };
  return {
    model,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [{ type: WEB_SEARCH_TYPE, name: "web_search", max_uses: MAX_SEARCHES }, submit] as any,
    tool_choice: (force ? { type: "tool", name: submit.name } : { type: "auto" }) as any,
    messages,
  };
}

/** What to do with one response: done (has the submission), or the messages for the next round. Pure. */
export function nextStep(messages: any[], msg: { content: any[]; stop_reason: string }): { done: any } | { next: any[] } {
  const call = msg.content.find((b: any) => b.type === "tool_use" && b.name === EVALUATION_TOOL.name);
  if (call) return { done: call.input };
  const next = [...messages, { role: "assistant", content: msg.content }];
  if (msg.stop_reason !== "pause_turn") next.push({ role: "user", content: `Now submit your answer by calling the ${EVALUATION_TOOL.name} tool.` });
  return { next };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Evaluate companies through the Batches API. `log` reports progress. Throws before submitting if the estimated cost
 * of a round would exceed `budgetUsd` minus what's already been spent in this process.
 */
export async function evaluateBatch(
  items: BatchItem[],
  opts: { budgetUsd: number; estPerCompanyUsd: number; model?: string; log?: (s: string) => void },
): Promise<BatchOutcome[]> {
  const model = opts.model ?? MODEL;
  const log = opts.log ?? console.log;
  const api = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const pending = new Map<string, { item: BatchItem; messages: any[] }>(
    items.map((it) => [it.id, { item: it, messages: [{ role: "user", content: buildEvaluationPrompt(it.input, signalsForPrompt(it.signals)) }] }]),
  );
  const outcomes: BatchOutcome[] = [];

  for (let round = 1; round <= MAX_ROUNDS && pending.size > 0; round++) {
    // Round 1 is a full evaluation; later rounds are short continuations (estimated at a third of the cost).
    const est = pending.size * opts.estPerCompanyUsd * (round === 1 ? 1 : 0.35);
    if (usage.costUsd + est > opts.budgetUsd)
      throw new Error(`Round ${round}: estimated $${est.toFixed(2)} on top of $${usage.costUsd.toFixed(2)} spent would pass the $${opts.budgetUsd} cap. Not submitted.`);
    const force = round === MAX_ROUNDS;
    const requests = [...pending.entries()].map(([id, p]) => ({ custom_id: id, params: requestParams(p.messages, model, force) }));
    const batch = await api.messages.batches.create({ requests } as any);
    log(`Round ${round}: submitted batch ${batch.id} with ${requests.length} companies (est. $${est.toFixed(2)}). Waiting…`);

    let status: any = batch;
    const started = Date.now();
    while (status.processing_status !== "ended") {
      await sleep(POLL_MS);
      status = await api.messages.batches.retrieve(batch.id);
      const c = status.request_counts ?? {};
      log(`  ${Math.round((Date.now() - started) / 60000)} min: ${c.succeeded ?? 0} done, ${c.processing ?? 0} processing, ${c.errored ?? 0} errored`);
    }

    for await (const r of (await api.messages.batches.results(batch.id)) as any) {
      const p = pending.get(r.custom_id);
      if (!p) continue;
      if (r.result?.type !== "succeeded") {
        pending.delete(r.custom_id);
        outcomes.push({ id: r.custom_id, ok: false, error: `${r.result?.type ?? "unknown"}: ${JSON.stringify(r.result?.error ?? "").slice(0, 200)}` });
        continue;
      }
      const msg = r.result.message;
      meterBatch(model, msg.usage);
      const step = nextStep(p.messages, msg);
      if ("done" in step) {
        pending.delete(r.custom_id);
        try {
          const result = normalizeEvaluation(step.done);
          outcomes.push({ id: r.custom_id, ok: true, out: { result, composite: composite(result.scores), model, signals: p.item.signals } });
        } catch (e: any) {
          outcomes.push({ id: r.custom_id, ok: false, error: `bad submission: ${e.message}` });
        }
      } else {
        p.messages = step.next;
      }
    }
    log(`Round ${round} finished: ${outcomes.filter((o) => o.ok).length} evaluated so far, ${pending.size} need another round. Spent $${usage.costUsd.toFixed(2)}.`);
  }
  for (const [id] of pending) outcomes.push({ id, ok: false, error: `no submission after ${MAX_ROUNDS} rounds` });
  return outcomes;
}
