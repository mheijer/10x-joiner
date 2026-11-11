// The LTV evaluation rubric: the single source of truth for how companies are scored.
// Used by the seed script (batch) and the API (user-added companies).
// To change how we judge companies, change THIS file and re-run evaluations.

export type DimensionKey =
  | "market"
  | "pmf"
  | "moat"
  | "competition"
  | "hunch"
  | "business_model"
  | "capital"
  | "team"
  | "gtm"
  | "ai_positioning";

export interface Dimension {
  key: DimensionKey;
  label: string;
  courseAnchor: string;
  defaultWeight: number; // weights sum to 100
  // What a 1, 3 and 5 look like. Keeps scores consistent across 500+ companies.
  scale: { 1: string; 3: string; 5: string };
}

export const DIMENSIONS: Dimension[] = [
  {
    key: "market",
    label: "Market size & wave",
    courseAnchor: "TAM/SAM/SOM, Vernal market curve, Rachleff's Law, catching the wave",
    defaultWeight: 15,
    scale: {
      1: "Small or shrinking market; no tailwind",
      3: "Solid multi-$B market growing steadily",
      5: "Massive market riding a major wave (e.g. AI platform shift); market pulls product",
    },
  },
  {
    key: "pmf",
    label: "Product-market fit level",
    courseAnchor: "First Round Levels of PMF; Balfour's 4 checks; Sean Ellis 40%",
    defaultWeight: 15,
    scale: {
      1: "Nascent: few paying customers, unclear retention",
      3: "Developing/Strong: ~$5-25M ARR or equivalent, healthy retention signals",
      5: "Extreme: $25M+ ARR or hypergrowth, customers buy faster than company can deliver",
    },
  },
  {
    key: "moat",
    label: "Moat / defensibility",
    courseAnchor: "Helmer's 7 Powers; AI-era moats (memory, workflow, hidden work); jobs as moats",
    defaultWeight: 10,
    scale: {
      1: "Feature or thin wrapper; easily copied",
      3: "Some switching costs or data advantage",
      5: "Multiple powers (network effects, switching costs, cornered resource, scale)",
    },
  },
  {
    key: "competition",
    label: "Competitive intensity (blue vs red ocean)",
    courseAnchor: "Blue Ocean Strategy; Wiz 'blue ocean inside the red ocean'",
    defaultWeight: 10,
    scale: {
      1: "Bloody red ocean vs. well-funded incumbents with no clear wedge",
      3: "Crowded but with a clear differentiated position",
      5: "Category leader or effectively uncontested space",
    },
  },
  {
    key: "hunch",
    label: "HUNCH (hair on fire, usage, NPS, churn, WTP)",
    courseAnchor: "Bussgang's HUNCH; Seibel hair-on-fire; Page toothbrush test",
    defaultWeight: 10,
    scale: {
      1: "Nice-to-have; weak usage or willingness to pay",
      3: "Real pain, regular usage, decent retention",
      5: "Hair-on-fire must-have, daily usage, beloved, high WTP",
    },
  },
  {
    key: "business_model",
    label: "Business model quality",
    courseAnchor: "10x club vs 6-8x vs 2-3x tiers; NDR >100%; gross margin; magical elements",
    defaultWeight: 10,
    scale: {
      1: "Low margin, one-time or ad revenue, worsens with scale (2-3x tier)",
      3: "Recurring subscription/transaction, moderate margins (6-8x tier)",
      5: "High GM, NDR >120%, network effects, improves with scale (10x club)",
    },
  },
  {
    key: "capital",
    label: "Capital & momentum",
    courseAnchor: "Round step-ups, runway, Paley 'VC is a hell of a drug', premature scaling",
    defaultWeight: 10,
    scale: {
      1: "Struggling to raise, flat/down rounds, short runway",
      3: "Raised recently at a reasonable step-up; adequate runway",
      5: "Top-tier investors pre-empting rounds at large step-ups; long runway",
    },
  },
  {
    key: "team",
    label: "Team / founder-market fit",
    courseAnchor: "Earned secrets, founder-market fit (and the FMF trap), founder velocity",
    defaultWeight: 10,
    scale: {
      1: "No evident domain edge; high turnover",
      3: "Credible founders with relevant experience",
      5: "Repeat/exceptional founders with an earned secret and proven velocity",
    },
  },
  {
    key: "gtm",
    label: "Go-to-market fit",
    courseAnchor: "Elephants/deer/mice (ACV vs sales model), Sales Learning Curve, PLG trap",
    defaultWeight: 5,
    scale: {
      1: "Sales motion mismatched to ACV; no repeatable channel",
      3: "Motion fits ACV; early repeatability",
      5: "Proven, scaling engine (multiple motions, strong sales yield)",
    },
  },
  {
    key: "ai_positioning",
    label: "AI positioning",
    courseAnchor: "Copilot vs autopilot ('services as software'); Supernova vs Shooting Star; systems of intelligence",
    defaultWeight: 5,
    scale: {
      1: "Likely disrupted by AI; no AI strategy",
      3: "AI-enhanced product (copilot)",
      5: "AI-native, sells outcomes (autopilot) or owns a key layer of the AI stack",
    },
  },
];

export const DEFAULT_WEIGHTS: Record<DimensionKey, number> = Object.fromEntries(
  DIMENSIONS.map((d) => [d.key, d.defaultWeight]),
) as Record<DimensionKey, number>;

export type Confidence = "low" | "medium" | "high";

export interface DimensionScore {
  score: number; // 1-5
  confidence: Confidence;
  rationale: string;
  sources: string[]; // URLs
}

export interface EvaluationResult {
  summary: string; // 1-2 sentence "why this company matters"
  facts: {
    stage?: string | null;
    headcount_estimate?: number | null;
    hq_city?: string | null;
    total_funding_usd?: number | null;
    latest_post_money_usd?: number | null;
    post_money_is_estimate?: boolean;
    funding_rounds?: {
      round: string;
      date?: string | null; // YYYY-MM or YYYY-MM-DD
      amount_usd?: number | null;
      post_money_usd?: number | null;
      source?: string | null;
    }[];
    careers_url?: string | null;
    ats?: { provider: "greenhouse" | "lever" | "ashby" | null; slug: string | null } | null;
  };
  scores: Record<DimensionKey, DimensionScore>;
}

export interface CompanyInput {
  name: string;
  website?: string | null;
  description?: string | null;
  industry?: string | null;
  hq_location?: string | null;
  founded_year?: number | string | null;
  employees?: number | string | null;
  total_funding_musd?: number | string | null;
}

export const SYSTEM_PROMPT = `You are a venture analyst trained in Harvard Business School's "Launching Tech Ventures" (LTV) course.
You evaluate startups for MBA students deciding which companies to join.
Be directionally right, concise and honest. Prefer recent sources (last 12 months). Never invent numbers:
if a figure is unknown, estimate it only where asked and mark it as an estimate, or return null.
Score each dimension 1-5 using the anchors provided, and calibrate across companies: a 5 should be rare.`;

export function buildEvaluationPrompt(c: CompanyInput): string {
  const known = [
    `Name: ${c.name}`,
    c.website && `Website: ${c.website}`,
    c.industry && `Industry: ${c.industry}`,
    c.hq_location && `HQ: ${c.hq_location}`,
    c.founded_year && `Founded: ${c.founded_year}`,
    c.employees && `Employees (from list): ${c.employees}`,
    c.total_funding_musd && `Total funding (from list): $${c.total_funding_musd}M`,
    c.description && `Description: ${c.description}`,
  ]
    .filter(Boolean)
    .join("\n");

  const rubric = DIMENSIONS.map(
    (d) =>
      `- "${d.key}" — ${d.label} (course anchor: ${d.courseAnchor})\n    1 = ${d.scale[1]}\n    3 = ${d.scale[3]}\n    5 = ${d.scale[5]}`,
  ).join("\n");

  return `Evaluate this startup.

## What we already know
${known}

## Research
Use web search (company site, TechCrunch, funding announcements, press, careers page) to find:
recent funding rounds and valuation, revenue/ARR or growth signals, customers, competitors, headcount, and leadership.
Also find the careers page and whether it is hosted on Greenhouse (boards.greenhouse.io/<slug> or job-boards.greenhouse.io/<slug>),
Lever (jobs.lever.co/<slug>) or Ashby (jobs.ashbyhq.com/<slug>).

## Rubric (score each 1-5)
${rubric}

## Output
Return ONLY a JSON object (no markdown fences) with exactly this shape:
{
  "summary": "1-2 sentences on what the company does and why it could (or could not) be a 10x company",
  "facts": {
    "stage": "Seed | Series A | Series B | Series C | Series D+ | Growth | Public | Acquired",
    "headcount_estimate": number | null,
    "hq_city": "City, ST" | null,
    "total_funding_usd": number | null,
    "latest_post_money_usd": number | null,
    "post_money_is_estimate": boolean,
    "funding_rounds": [{"round": "Series B", "date": "2025-06", "amount_usd": 100000000, "post_money_usd": 1000000000, "source": "url"}],
    "careers_url": "url" | null,
    "ats": {"provider": "greenhouse" | "lever" | "ashby" | null, "slug": "string" | null}
  },
  "scores": {
    ${DIMENSIONS.map((d) => `"${d.key}": {"score": 1-5, "confidence": "low|medium|high", "rationale": "1-2 sentences citing evidence", "sources": ["url"]}`).join(",\n    ")}
  }
}`;
}

// Validate and clamp a model response into an EvaluationResult. Throws on unusable output.
export function parseEvaluation(raw: string): EvaluationResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model output");
  const obj = JSON.parse(raw.slice(start, end + 1));

  if (!obj.scores || typeof obj.scores !== "object") throw new Error("Missing scores");
  const scores = {} as Record<DimensionKey, DimensionScore>;
  for (const d of DIMENSIONS) {
    const s = obj.scores[d.key];
    if (!s || typeof s.score !== "number") throw new Error(`Missing score for ${d.key}`);
    const conf: Confidence = ["low", "medium", "high"].includes(s.confidence) ? s.confidence : "low";
    scores[d.key] = {
      score: Math.min(5, Math.max(1, Math.round(s.score * 2) / 2)),
      confidence: conf,
      rationale: String(s.rationale ?? ""),
      sources: Array.isArray(s.sources) ? s.sources.filter((u: unknown) => typeof u === "string").slice(0, 5) : [],
    };
  }
  return { summary: String(obj.summary ?? ""), facts: obj.facts ?? {}, scores };
}
