// AI search (server-only): turns a free-form question ("Series B healthcare AI in Boston that hires PMs") into a
// short ranked list of companies, each with a one-line reason, plus any hard filters the question implies.
// One fast, cheap call per search (Haiku, ~$0.003): the model reads a compact catalog of every company's name,
// sector, stage, HQ and description. It only picks from the catalog; it never invents companies or numbers.
import { askForTool } from "./claude.ts";

export const SEARCH_MODEL = process.env.SEARCH_MODEL || "claude-haiku-5-5";

export interface CatalogRow {
  id: string;
  name: string;
  sector: string | null;
  stage: string | null;
  hq_city: string | null;
  headcount: number | null;
  description: string | null;
  evaluated: boolean;
}

export interface SearchResult {
  understood: string; // one line: how the question was read
  picks: { id: string; reason: string }[];
  filters: {
    stage_buckets?: ("early" | "mid" | "late")[];
    locations?: string[];
    headcount_min?: number | null;
    headcount_max?: number | null;
  };
}

const TOOL = {
  name: "submit_search",
  description: "Submit the companies that best answer the question, best first.",
  input_schema: {
    type: "object",
    properties: {
      understood: { type: "string", description: "One short line: what the user is looking for" },
      picks: {
        type: "array",
        maxItems: 25,
        items: {
          type: "object",
          properties: {
            n: { type: "integer", description: "Catalog line number" },
            reason: { type: "string", description: "Under 15 words, grounded in the catalog line" },
          },
          required: ["n", "reason"],
        },
      },
      filters: {
        type: "object",
        description: "Only hard constraints the question states explicitly",
        properties: {
          stage_buckets: { type: "array", items: { type: "string", enum: ["early", "mid", "late"] } },
          locations: { type: "array", items: { type: "string" }, description: "City names as written in the catalog" },
          headcount_min: { type: ["integer", "null"] },
          headcount_max: { type: ["integer", "null"] },
        },
      },
    },
    required: ["understood", "picks", "filters"],
  },
};

const clip = (s: string | null, n: number) => (s ?? "").replace(/\s+/g, " ").slice(0, n);

export async function aiSearch(question: string, catalog: CatalogRow[]): Promise<SearchResult> {
  const lines = catalog
    .map((c, i) => `${i}|${c.name}|${c.sector ?? ""}|${c.stage ?? "?"}|${c.hq_city ?? "?"}|${c.headcount ?? "?"}|${clip(c.description, 160)}`)
    .join("\n");
  const out = await askForTool<any>({
    model: SEARCH_MODEL,
    maxTokens: 2500,
    tool: TOOL,
    system: `You help HBS MBA students find startups to join. Pick companies ONLY from the catalog, by line number.
Match on meaning, not just keywords (e.g. "hospitals" matches clinical or healthcare-provider companies).
Respect stated constraints (location, stage, size). Stage buckets: early = Pre-seed to Series A, mid = Series B-C, late = Series D+.
Return up to 25 picks, best first; fewer is fine if few truly match. Never invent facts beyond the catalog line.`,
    prompt: `Catalog (line|name|sector|stage|HQ|headcount|description):
${lines}

Question: ${question}

Call submit_search.`,
  });
  const picks = (Array.isArray(out.picks) ? out.picks : [])
    .map((p: any) => ({ row: catalog[Number(p.n)], reason: String(p.reason ?? "") }))
    .filter((p: any) => p.row)
    .map((p: any) => ({ id: p.row.id, reason: p.reason }));
  const seen = new Set<string>();
  return {
    understood: String(out.understood ?? ""),
    picks: picks.filter((p: { id: string }) => (seen.has(p.id) ? false : (seen.add(p.id), true))),
    filters: out.filters ?? {},
  };
}
