// Batch evaluation: same request as the synchronous path, the same continuation rules, and batch pricing.
import assert from "node:assert/strict";
import { requestParams, nextStep, batchCostUsd, BATCH_DISCOUNT } from "../lib/batch.ts";
import { EVALUATION_TOOL, SYSTEM_PROMPT } from "../lib/rubric.ts";

const msgs = [{ role: "user", content: "Evaluate Acme" }];
const p = requestParams(msgs, "claude-opus-5-5", false);
assert.equal(p.system, SYSTEM_PROMPT);
assert.equal(p.tools.length, 2, "web search + submit_evaluation");
assert.equal(p.tools[0].name, "web_search");
assert.equal(p.tools[1].name, EVALUATION_TOOL.name);
assert.deepEqual(p.tool_choice, { type: "auto" }, "round 1 lets the model research");
assert.deepEqual(requestParams(msgs, "claude-opus-5-5", true).tool_choice, { type: "tool", name: EVALUATION_TOOL.name }, "last round forces a submission");

// Submitted → done
const done = nextStep(msgs, { stop_reason: "tool_use", content: [{ type: "text", text: "ok" }, { type: "tool_use", name: EVALUATION_TOOL.name, input: { summary: "x" } }] });
assert.ok("done" in done && done.done.summary === "x");
// Paused (long web search) → continue as-is
const paused = nextStep(msgs, { stop_reason: "pause_turn", content: [{ type: "server_tool_use", name: "web_search" }] });
assert.ok("next" in paused && paused.next.length === 2 && paused.next[1].role === "assistant");
// Ended without submitting → ask to submit (same nudge as the sync loop)
const ended = nextStep(msgs, { stop_reason: "end_turn", content: [{ type: "text", text: "Here is my analysis…" }] });
assert.ok("next" in ended && ended.next.length === 3 && /submit/.test(ended.next[2].content));

// Batch price: tokens at 50%, web searches at full price
const u = { input_tokens: 143_000, output_tokens: 6_000, server_tool_use: { web_search_requests: 5 } };
const full = (143_000 * 4 + 6_000 * 20) / 1e6; // $0.692 at standard Opus prices
assert.ok(Math.abs(batchCostUsd("claude-opus-5-5", u) - (full * BATCH_DISCOUNT + 0.05)) < 1e-9);
console.log("BATCH OK", batchCostUsd("claude-opus-5-5", u).toFixed(3));
