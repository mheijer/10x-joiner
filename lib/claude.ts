// Thin wrapper around the Claude API. Server-side only (never import from client components).
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
// Web search server tool. If Anthropic ships a newer version string, set WEB_SEARCH_TOOL_TYPE.
const WEB_SEARCH_TYPE = process.env.WEB_SEARCH_TOOL_TYPE || "web_search_20250305";

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
}): Promise<string> {
  const tools = opts.webSearch
    ? ([{ type: WEB_SEARCH_TYPE, name: "web_search", max_uses: opts.maxSearches ?? 6 }] as any)
    : undefined;

  const messages: any[] = [{ role: "user", content: opts.prompt }];
  // Long searches can return stop_reason "pause_turn"; continue the turn up to 3 times.
  for (let i = 0; i < 4; i++) {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 4000,
      system: opts.system,
      tools,
      messages,
    });
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    return res.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
  }
  throw new Error("Claude did not finish after several continuations");
}
