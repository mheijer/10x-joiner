// Thin wrapper around the Claude API. Server-side only (never import from client components).
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5"; // team decision: Opus for quality
// Web search server tool. If Anthropic ships a newer version string, set WEB_SEARCH_TOOL_TYPE.
const WEB_SEARCH_TYPE = process.env.WEB_SEARCH_TOOL_TYPE || "web_search_20250305";

// ---------------------------------------------------------------- cost meter
// USD per million tokens (standard tier) and per web search, from platform.claude.com/docs/en/about-claude/pricing
// (checked Nov 12, 2026). Update if prices change.
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-opus-5-5": { input: 4, output: 20 },
};
export const WEB_SEARCH_USD = 0.01;

export const usage = { calls: 0, inputTokens: 0, outputTokens: 0, webSearches: 0, costUsd: 0 };

function meter(model: string, u: any) {
  const p = PRICES[model] ?? PRICES["claude-opus-5-5"];
  const input = (u?.input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0) * 1.25 + (u?.cache_read_input_tokens ?? 0) * 0.1;
  const searches = u?.server_tool_use?.web_search_requests ?? 0;
  usage.calls++;
  usage.inputTokens += u?.input_tokens ?? 0;
  usage.outputTokens += u?.output_tokens ?? 0;
  usage.webSearches += searches;
  usage.costUsd += (input * p.input + (u?.output_tokens ?? 0) * p.output) / 1e6 + searches * WEB_SEARCH_USD;
}

let _client: Anthropic | null = null;
function client() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/** Ask Claude a question, optionally letting it search the web. Returns the final text. */
export async function ask(opts: {
  system: string;
  prompt: string;
  webSearch?: boolean;
  maxSearches?: number;
  maxTokens?: number;
  model?: string;
}): Promise<string> {
  const model = opts.model ?? MODEL;
  const tools = opts.webSearch
    ? ([{ type: WEB_SEARCH_TYPE, name: "web_search", max_uses: opts.maxSearches ?? 6 }] as any)
    : undefined;

  const messages: any[] = [{ role: "user", content: opts.prompt }];
  // Long searches can return stop_reason "pause_turn"; continue the turn up to 3 times.
  for (let i = 0; i < 4; i++) {
    const res = await client().messages.create({
      model,
      max_tokens: opts.maxTokens ?? 4000,
      system: opts.system,
      tools,
      messages,
    });
    meter(model, res.usage);
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    // Join with "" not "\n": web-search citations split one answer into several text blocks.
    return res.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");
  }
  throw new Error("Claude did not finish after several continuations");
}

/**
 * Ask Claude to research (optionally with web search) and then submit its answer through a tool whose input is
 * validated against a JSON schema. The API returns the tool input as parsed JSON, so malformed output (a stray
 * quote in a long rationale) can't break parsing. Returns the tool input object.
 */
export async function askForTool<T = any>(opts: {
  system: string;
  prompt: string;
  tool: { name: string; description: string; input_schema: Record<string, unknown> };
  webSearch?: boolean;
  maxSearches?: number;
  maxTokens?: number;
  model?: string;
}): Promise<T> {
  const model = opts.model ?? MODEL;
  const submit = { name: opts.tool.name, description: opts.tool.description, input_schema: opts.tool.input_schema };
  const research: any[] = opts.webSearch ? [{ type: WEB_SEARCH_TYPE, name: "web_search", max_uses: opts.maxSearches ?? 5 }] : [];
  const messages: any[] = [{ role: "user", content: opts.prompt }];

  for (let i = 0; i < 5; i++) {
    // On the last chance, force the submit tool so the turn always ends with structured output.
    const force = i >= 3;
    const res = await client().messages.create({
      model,
      max_tokens: opts.maxTokens ?? 8000,
      system: opts.system,
      tools: [...research, submit] as any, // keep web_search defined: the history may contain its results
      tool_choice: force ? ({ type: "tool", name: submit.name } as any) : ({ type: "auto" } as any),
      messages,
    });
    meter(model, res.usage);
    const call = res.content.find((b: any) => b.type === "tool_use" && b.name === submit.name) as any;
    if (call) return call.input as T;
    messages.push({ role: "assistant", content: res.content });
    if (res.stop_reason === "pause_turn") continue; // long web search: let it keep going
    messages.push({ role: "user", content: `Now submit your answer by calling the ${submit.name} tool.` });
  }
  throw new Error(`Claude did not call ${submit.name}`);
}
