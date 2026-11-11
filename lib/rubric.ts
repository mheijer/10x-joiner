// The LTV evaluation rubric (v2): the single source of truth for how companies are scored.
// Used by the seed script (batch) and the API (user-added companies).
// Rationale for every dimension and its course anchors: docs/SCORING_FRAMEWORK.md
//
// Three layers:
//   1. "winning" dimensions  → Probability of Winning (0-100): "Is this a great company?" (12 weighted, user-adjustable)
//   2. "joiner" dimensions   → Joiner Upside (0-100): "Is joining it, now, a great deal for me?"
//   3. red flags             → shown to the user; penalizing them is the user's choice (LTV Module 5)
// Plus plain facts (headcount, ARR, customer type, ...) used for filters and personal fit.

export type WinningKey =
  | "market"
  | "pmf"
  | "growth"
  | "moat"
  | "competition"
  | "business_model"
  | "gtm"
  | "independence"
  | "risk_retirement"
  | "capital"
  | "team"
  | "ai_positioning";
export type JoinerKey = "valuation_headroom" | "career_velocity";
export type DimensionKey = WinningKey | JoinerKey;

export interface Dimension {
  key: DimensionKey;
  group: "winning" | "joiner";
  label: string;
  question: string; // the one question this dimension answers
  courseAnchor: string; // frameworks + cases from LTV
  defaultWeight: number; // within its group; winning weights sum to 100
  scale: { 1: string; 3: string; 5: string };
}

export const DIMENSIONS: Dimension[] = [
  // ---------------------------------------------------------------- Probability of Winning
  {
    key: "market",
    group: "winning",
    label: "Market, wave & expansion path",
    question: "Is the market big, riding a real wave, and is there a credible path from beachhead to bigger markets?",
    courseAnchor:
      "Rachleff's Law (Andreessen); TAM/SAM/SOM bottom-up; Vernal market curve; catching the wave; bowling pins / lily pads (C16, Squire, Sprout); Idea Maze",
    defaultWeight: 10,
    scale: {
      1: "Small or shrinking market, no tailwind, no visible expansion path",
      3: "Multi-$B market growing steadily; plausible adjacent expansion",
      5: "Massive market on a major wave; clear bowling-pin path to adjacent products/segments",
    },
  },
  {
    key: "pmf",
    group: "winning",
    label: "PMF level & customer love (HUNCH)",
    question: "How far along the PMF levels is it, and do customers treat it as a hair-on-fire must-have?",
    courseAnchor:
      "First Round Levels of PMF (Nascent → Extreme); Balfour's 4 checks; HUNCH (hair on fire, usage, NPS, churn, high WTP); Sean Ellis 40%; Page toothbrush test; 'usage leads, churn lags'",
    defaultWeight: 15,
    scale: {
      1: "Nascent: few paying customers; weak usage or retention signals",
      3: "Developing/Strong: ~$5-25M ARR (or equivalent), real pain, healthy retention",
      5: "Extreme: $25M+ ARR or hypergrowth; customers buy faster than it can deliver; must-have",
    },
  },
  {
    key: "growth",
    group: "winning",
    label: "Growth momentum",
    question: "How fast is the business growing right now, and is growth accelerating or slowing?",
    courseAnchor:
      "T2D3 (Battery) and Q2T3 (Bessemer State of AI); Supernova vs Shooting Star growth curves; Sales Learning Curve (AI compresses it, but 'only scales what already works'); First Round 'Demand' and 'Efficiency' axes; cohort expansion (Sprout NDR >150%)",
    defaultWeight: 10,
    scale: {
      1: "Flat or shrinking; growth decelerating sharply",
      3: "On a T2D3 pace (~3x/year early, ~2x later) with steady momentum",
      5: "Ahead of Q2T3 / Supernova pace and still accelerating",
    },
  },
  {
    key: "moat",
    group: "winning",
    label: "Moat / defensibility",
    question: "If a well-funded competitor copied the product tomorrow, what would still protect this company?",
    courseAnchor:
      "Helmer's 7 Powers (benefit + barrier); AI-era moats: memory/context, workflow ownership, 'hidden work' (a16z systems of intelligence); jobs-to-be-done as moats; avoiding the 'GPT wrapper' (Summer Health)",
    defaultWeight: 10,
    scale: {
      1: "A feature or thin wrapper; easily copied",
      3: "Some switching costs, proprietary data or workflow lock-in",
      5: "Multiple powers (network effects, switching costs, cornered resource, scale economies)",
    },
  },
  {
    key: "competition",
    group: "winning",
    label: "Competitive position (blue vs red ocean)",
    question: "Is it winning its category, or fighting in a bloody red ocean without a wedge?",
    courseAnchor: "Blue Ocean Strategy (Kim & Mauborgne); Wiz 'blue ocean inside the red ocean'; XYZ Robotics (commoditized red ocean)",
    defaultWeight: 10,
    scale: {
      1: "Red ocean vs well-funded incumbents, no clear wedge",
      3: "Crowded but clearly differentiated; top-3 position",
      5: "Clear category leader or effectively uncontested space",
    },
  },
  {
    key: "business_model",
    group: "winning",
    label: "Business model & unit economics",
    question: "Does each customer make money, and does the model get better with scale?",
    courseAnchor:
      "Business model tiers (10x club / 6-8x / 2-3x); magical elements (NDR >100%, high GM, network effects); LTV/CAC done right by cohort & channel (Comun: 'average numbers are trash'); 'free pies' (PMF isn't complete until BM works); Supernova vs Shooting Star margins (Bessemer); Fazeshift pricing ladder",
    defaultWeight: 8,
    scale: {
      1: "Low/negative margins, one-time or ad revenue, worsens with scale (2-3x tier)",
      3: "Recurring revenue, moderate margins, decent payback (6-8x tier)",
      5: "High GM, NDR >120%, short payback, improves with scale (10x club)",
    },
  },
  {
    key: "gtm",
    group: "winning",
    label: "GTM fit & ICP focus",
    question: "Does it know exactly who it sells to, and does its sales motion match its price point?",
    courseAnchor:
      "'Your ICP is your destiny' / narrow beachhead; ACV vs sales model (elephants, deer, mice); Sales Learning Curve phases; PLG trap (Bussgang & Jay; AllSpice, ElevenLabs); forward-deployed engineers (Blitzy); Clay's ICP commitment",
    defaultWeight: 7,
    scale: {
      1: "Fuzzy ICP; motion mismatched to ACV; no repeatable channel",
      3: "Clear ICP; motion fits ACV; early repeatability",
      5: "Sharp ICP with a proven, scaling engine (multiple motions, strong sales yield)",
    },
  },
  {
    key: "independence",
    group: "winning",
    label: "Gatekeeper & platform independence",
    question: "Does a partner, platform, channel or model provider control this company's fate?",
    courseAnchor:
      "'Beware gatekeepers' (Sweet 16 #7); Comun on Unit/BaaS; TurbineOne via the defense prime; Blitzy and systems integrators; AllSpice and enterprise procurement; 'rope-a-dope' partner strategy; dependence on frontier model providers",
    defaultWeight: 5,
    scale: {
      1: "One partner/platform/channel can cut it off or squeeze its economics",
      3: "Meaningful dependencies with credible alternatives or a plan to own the stack",
      5: "Owns its customer relationship, stack and distribution",
    },
  },
  {
    key: "risk_retirement",
    group: "winning",
    label: "Key risks retired",
    question: "Which of the big risks (technology, market, GTM, business model, regulatory, financing) are already behind it, and how dangerous is the biggest one left?",
    courseAnchor:
      "C16 Bio (sequence experiments to retire the biggest risk first: science, techno-economic, PMF, scaling, financing); 'test selection is strategy'; Lean Startup (validate every key hypothesis before scaling); tough tech as 'the sport of kings' (XYZ Robotics); Steve Blank's defense 'valley of death'",
    defaultWeight: 5,
    scale: {
      1: "Existential risks still open (unproven technology, regulatory approval, or no business model yet)",
      3: "Core technology and demand proven; scaling, business model or regulatory risk remains",
      5: "Technology, demand, GTM and economics all proven; remaining risks are ordinary execution",
    },
  },
  {
    key: "capital",
    group: "winning",
    label: "Capital strategy & efficiency",
    question: "Is it funded well for its plan, and is it efficient rather than scaling prematurely?",
    courseAnchor:
      "Paley 'VC is a hell of a drug' (value per dollar raised); premature scaling (Startup Genome ~70%; Chief 'blitzflailing'); seedstrapping (BoldVoice: $10M ARR with 7 people); Investor-Market Fit; VC treadmill (XYZ Robotics); revenue per employee",
    defaultWeight: 5,
    scale: {
      1: "Struggling to raise, flat/down rounds, short runway, or burning far ahead of traction",
      3: "Raised recently at a sensible step-up; adequate runway; spend roughly matches traction",
      5: "Top-tier investors pre-empting at big step-ups AND efficient (high revenue per employee, long runway)",
    },
  },
  {
    key: "team",
    group: "winning",
    label: "Team, founder-market fit & velocity",
    question: "Do the founders have an earned secret and the speed to out-execute?",
    courseAnchor:
      "Earned secrets (Tavel); founder-market fit and the FMF trap; Founder Velocity score (Wiz deck); courage to pivot ('burn the boats'); early-stage CEO's job (Bardin)",
    defaultWeight: 10,
    scale: {
      1: "No evident domain edge; key departures",
      3: "Credible founders with relevant experience",
      5: "Exceptional/repeat founders with an earned secret and proven execution velocity",
    },
  },
  {
    key: "ai_positioning",
    group: "winning",
    label: "AI positioning",
    question: "Does AI make this company stronger, or is it about to be disrupted by AI?",
    courseAnchor:
      "Services as software: copilot vs autopilot (Sequoia); system of record → system of intelligence (a16z); Supernova vs Shooting Star (Bessemer); Summer Health (AI-first vs AI-enhanced); 'AI increases output, not taste'",
    defaultWeight: 5,
    scale: {
      1: "Likely disrupted by AI; no credible AI strategy",
      3: "AI-enhanced product (copilot)",
      5: "AI-native, sells outcomes (autopilot) or owns a key layer of the AI stack",
    },
  },

  // ---------------------------------------------------------------- Joiner Upside
  {
    key: "valuation_headroom",
    group: "joiner",
    label: "Valuation headroom",
    question: "At today's valuation, is there still room for a joiner's equity to multiply?",
    courseAnchor:
      "Valuation equation (TAM × penetration × profitability × multiple); business model tiers set the multiple; Paley (big valuations raise the exit bar); Chief ('we raised so much because we could'); Supernova fragility",
    defaultWeight: 50,
    scale: {
      1: "Priced for perfection: very high multiple vs growth and model quality; little room to 10x",
      3: "Fair price for its growth; 3-5x upside plausible in a good outcome",
      5: "Underpriced vs traction and market; 10x+ from here is plausible",
    },
  },
  {
    key: "career_velocity",
    group: "joiner",
    label: "Career velocity",
    question: "Will a new joiner get scope, learning and a résumé-making experience here?",
    courseAnchor:
      "10x Joiner workshop (own metrics, optimize for learning, ride the AI wave); org stages (family → tribe → village → city, Hoffman); 'avoid titles early'; FDE / GTM engineer roles; talent density",
    defaultWeight: 50,
    scale: {
      1: "Stalled or shrinking; narrow roles; talent leaving",
      3: "Growing steadily; reasonable scope for new hires",
      5: "Hypergrowth headcount, high talent density, big scope early",
    },
  },
];

export const WINNING_DIMENSIONS = DIMENSIONS.filter((d) => d.group === "winning");
export const JOINER_DIMENSIONS = DIMENSIONS.filter((d) => d.group === "joiner");

export const DEFAULT_WEIGHTS = Object.fromEntries(WINNING_DIMENSIONS.map((d) => [d.key, d.defaultWeight])) as Record<
  WinningKey,
  number
>;

// ---------------------------------------------------------------- red flags (LTV Module 5)
export type RedFlagType =
  | "governance_ethics" // fraud, regulatory action, misconduct (Rothenberg, Griffith 'one bad apple')
  | "overstated_metrics" // claims that don't hold up ('foie gras effect')
  | "leadership_exodus"
  | "layoffs_or_down_round"
  | "legal_or_regulatory"
  | "customer_or_partner_concentration";
export type Severity = "low" | "medium" | "high";
export interface RedFlag {
  type: RedFlagType;
  severity: Severity;
  detail: string;
  source: string | null;
}

// ---------------------------------------------------------------- facts (filters + fit)
export interface Facts {
  as_of?: string | null; // YYYY-MM of the freshest source used
  stage?: string | null;
  founded_year?: number | null;
  hq_city?: string | null; // "City, ST"
  office_locations?: string[];
  work_policy?: "onsite" | "hybrid" | "remote" | "unknown" | null;
  headcount_estimate?: number | null;
  headcount_growth_12m_pct?: number | null;
  total_funding_usd?: number | null;
  latest_post_money_usd?: number | null;
  post_money_is_estimate?: boolean;
  arr_estimate_usd?: number | null;
  arr_as_of?: string | null;
  arr_is_estimate?: boolean;
  funding_rounds?: {
    round: string;
    date?: string | null; // YYYY-MM or YYYY-MM-DD
    amount_usd?: number | null;
    post_money_usd?: number | null;
    lead_investors?: string[];
    source?: string | null;
  }[];
  top_investors?: string[];
  customer_type?: ("enterprise" | "mid_market" | "smb" | "consumer" | "government")[]; // market curve position
  business_type?: "b2b" | "b2c" | "b2b2c" | "marketplace" | null;
  gtm_motion?: ("sales_led" | "plg" | "fde" | "channel" | "paid_acquisition")[];
  pricing_model?: ("seat" | "usage" | "outcome" | "subscription" | "transaction" | "ads" | "hardware")[];
  founders?: { name: string; background: string; repeat_founder: boolean }[];
  notable_customers?: string[];
  competitors?: string[];
  sponsors_visas?: "yes" | "likely" | "unknown" | "no";
  careers_url?: string | null;
  ats?: { provider: "greenhouse" | "lever" | "ashby" | null; slug: string | null } | null;
}

export type Confidence = "low" | "medium" | "high";

export interface DimensionScore {
  score: number; // 1-5 (half points allowed)
  confidence: Confidence;
  rationale: string;
  sources: string[]; // URLs
}

export interface EvaluationResult {
  summary: string;
  facts: Facts;
  scores: Record<DimensionKey, DimensionScore>;
  red_flags: RedFlag[];
  conflicts: string[]; // places where sources disagreed, and which one we used
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

export const SYSTEM_PROMPT = `You are a venture analyst trained in Harvard Business School's "Launching Tech Ventures" (LTV) course
(Profs. Jeff Bussgang and Allison Mnookin). You evaluate startups for MBA students deciding which companies to join.

Principles:
- Be directionally right, concise and honest. Score with the anchors given; a 5 should be rare and earned.
- Never invent numbers. If unknown, return null. If you estimate, set the matching *_is_estimate flag.
- Calibration reference: Sierra (AI customer-service agents, $400M+ ARR ~2.5 years after launch, $15.8B valuation in May 2026)
  scores 5 on PMF and market; a pre-revenue seed company scores 1-2 on PMF.

Source rules (most to least trusted):
  1. Primary: the company's own site/blog/press releases, SEC filings, founder statements on record.
  2. Tier-1 press: TechCrunch, Bloomberg, Reuters, WSJ, The Information, CNBC, Axios, Forbes.
  3. Research firms: Sacra, PitchBook/Crunchbase news, CB Insights.
  4. Aggregators and SEO/AI-generated pages: use only if nothing better exists, and mark figures as estimates.
- When sources disagree (e.g. round names, valuations, ARR), prefer the most recent primary or tier-1 source,
  and record the disagreement in "conflicts".
- The provided list data may be stale. Always prefer fresher figures you find, and note the date (as_of).`;

export function buildEvaluationPrompt(c: CompanyInput): string {
  const known = [
    `Name: ${c.name}`,
    c.website && `Website: ${c.website}`,
    c.industry && `Industry: ${c.industry}`,
    c.hq_location && `HQ: ${c.hq_location}`,
    c.founded_year && `Founded: ${c.founded_year}`,
    c.employees && `Employees (from list, may be stale): ${c.employees}`,
    c.total_funding_musd && `Total funding (from list, may be stale): $${c.total_funding_musd}M`,
    c.description && `Description: ${c.description}`,
  ]
    .filter(Boolean)
    .join("\n");

  const rubric = (dims: Dimension[]) =>
    dims
      .map(
        (d) =>
          `- "${d.key}": ${d.label}. ${d.question}\n    Course anchors: ${d.courseAnchor}\n    1 = ${d.scale[1]}\n    3 = ${d.scale[3]}\n    5 = ${d.scale[5]}`,
      )
      .join("\n");

  const scoreLine = (d: Dimension) =>
    `"${d.key}": {"score": 1-5, "confidence": "low|medium|high", "rationale": "1-2 sentences citing specific evidence", "sources": ["url"]}`;

  return `Evaluate this startup for an MBA student considering joining it.

## What we already know (from Prof. Bussgang's Rocketship List; may be stale)
${known}

## Research (use web search)
Find: latest funding rounds and valuation; ARR/revenue and its growth rate over time (is it accelerating?); headcount and its growth over the last year;
customers and who buys (enterprise/SMB/consumer); pricing model and sales motion; competitors; founders' backgrounds;
key dependencies (platforms, partners, channels, model providers); any red flags (lawsuits, regulatory action,
layoffs, down rounds, leadership departures, disputed metrics); work policy and office locations;
whether it sponsors work visas (e.g. H-1B filings); and the careers page. Note whether the careers page is on
Greenhouse (boards.greenhouse.io/<slug> or job-boards.greenhouse.io/<slug>), Lever (jobs.lever.co/<slug>) or Ashby (jobs.ashbyhq.com/<slug>).

## Probability of Winning ("is this a great company?"): score each 1-5
${rubric(WINNING_DIMENSIONS)}

## Joiner Upside ("is joining now a great deal for a new hire?"): score each 1-5
${rubric(JOINER_DIMENSIONS)}

## Output
Return ONLY a JSON object (no markdown fences) with exactly this shape:
{
  "summary": "1-2 sentences: what it does and why it could (or could not) be a 10x company",
  "facts": {
    "as_of": "YYYY-MM", "stage": "Seed | Series A | Series B | Series C | Series D+ | Growth | Public | Acquired",
    "founded_year": number|null, "hq_city": "City, ST"|null, "office_locations": ["City, ST"],
    "work_policy": "onsite|hybrid|remote|unknown",
    "headcount_estimate": number|null, "headcount_growth_12m_pct": number|null,
    "total_funding_usd": number|null, "latest_post_money_usd": number|null, "post_money_is_estimate": boolean,
    "arr_estimate_usd": number|null, "arr_as_of": "YYYY-MM"|null, "arr_is_estimate": boolean,
    "funding_rounds": [{"round": "Series B", "date": "2025-06", "amount_usd": 100000000, "post_money_usd": 1000000000, "lead_investors": ["..."], "source": "url"}],
    "top_investors": ["..."],
    "customer_type": ["enterprise|mid_market|smb|consumer|government"],
    "business_type": "b2b|b2c|b2b2c|marketplace",
    "gtm_motion": ["sales_led|plg|fde|channel|paid_acquisition"],
    "pricing_model": ["seat|usage|outcome|subscription|transaction|ads|hardware"],
    "founders": [{"name": "...", "background": "short", "repeat_founder": boolean}],
    "notable_customers": ["..."], "competitors": ["..."],
    "sponsors_visas": "yes|likely|unknown|no",
    "careers_url": "url"|null, "ats": {"provider": "greenhouse|lever|ashby"|null, "slug": "string"|null}
  },
  "scores": {
    ${DIMENSIONS.map(scoreLine).join(",\n    ")}
  },
  "red_flags": [{"type": "governance_ethics|overstated_metrics|leadership_exodus|layoffs_or_down_round|legal_or_regulatory|customer_or_partner_concentration", "severity": "low|medium|high", "detail": "one line", "source": "url"}],
  "conflicts": ["e.g. 'Aggregators label the Feb 2024 round Seed vs Series A; used company blog'"]
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
  const severities = ["low", "medium", "high"];
  const red_flags: RedFlag[] = Array.isArray(obj.red_flags)
    ? obj.red_flags
        .filter((f: any) => f && typeof f.detail === "string")
        .map((f: any) => ({
          type: f.type,
          severity: severities.includes(f.severity) ? f.severity : "low",
          detail: f.detail,
          source: typeof f.source === "string" ? f.source : null,
        }))
    : [];
  return {
    summary: String(obj.summary ?? ""),
    facts: obj.facts ?? {},
    scores,
    red_flags,
    conflicts: Array.isArray(obj.conflicts) ? obj.conflicts.map(String) : [],
  };
}
