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
    label: "PMF, job-to-be-done & customer love (HUNCH)",
    question: "What job is the customer hiring it for, is it 10x better than the substitute, and how far along the PMF levels is it?",
    courseAnchor:
      "Jobs to Be Done (the job, not the demographic; Forces of Progress: push + pull must beat anxiety + habit); hair-on-fire and 10x better than the closest substitute (Seibel, Thiel); First Round Levels of PMF (Nascent → Extreme); Balfour's 4 checks; HUNCH (hair on fire, usage, NPS, churn, high WTP); Sean Ellis 40%; Page toothbrush test; 'usage leads, churn lags'; Crossing the Chasm (early-adopter love can be a false positive)",
    defaultWeight: 15,
    scale: {
      1: "Nascent: unclear job, few paying customers, weak usage or retention; or only early adopters so far",
      3: "Developing/Strong: clear job, ~$5-25M ARR (or equivalent), real pain, healthy retention beyond early adopters",
      5: "Extreme: a hair-on-fire job done 10x better; $25M+ ARR or hypergrowth; customers buy faster than it can deliver",
    },
  },
  {
    key: "growth",
    group: "winning",
    label: "Growth momentum",
    question: "How fast are revenue, customers and usage growing right now, and is growth accelerating or slowing? (Funding pace can corroborate, but not replace, customer growth.)",
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
    label: "Team, founder-market fit & 10x org",
    question: "Do the founders have an earned secret, the speed to out-execute, and an AI-native '10x organization'?",
    courseAnchor:
      "Earned secrets (Tavel); founder-market fit and the FMF trap; Founder Velocity score (Wiz deck: build speed, experimentation velocity, customer-loop speed, leverage); 10x org = AI brain + harness + process (Sweet 16 #13; 'Blitzy building Blitzy'); talent density (Who Method); courage to pivot ('burn the boats'); early-stage CEO's job (Bardin)",
    defaultWeight: 10,
    scale: {
      1: "No evident domain edge; key departures",
      3: "Credible founders with relevant experience",
      5: "Exceptional/repeat founders with an earned secret, proven velocity, and an AI-native org (high output per person)",
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

/**
 * Plain-English explainers for each check, shown when a user clicks "What is …?" in the scorecard. The course
 * frameworks and cases behind each check (courseAnchor) are listed there, not on every row.
 */
export const EXPLAINERS: Record<DimensionKey, { what: string; why: string }> = {
  market: {
    what: "How big the opportunity is, whether a technology or behavior shift (a 'wave') is lifting it now, and whether the company has a path from its first market into bigger adjacent ones.",
    why: "Great teams in small or shrinking markets cap out. A big, growing market lets a company make mistakes and still win, which is what makes your equity worth something.",
  },
  pmf: {
    what: "Product-market fit: whether customers clearly need the product to get a job done, and show it through revenue, retention, usage and word of mouth, not just interest.",
    why: "PMF is the dividing line between a startup searching for a business and one scaling a business. Joining before it means more risk and more upside; after it, the work is about scaling.",
  },
  growth: {
    what: "How fast the business is growing (revenue, customers, usage) and whether that growth is speeding up or slowing down.",
    why: "Growth compounds into valuation, promotions and new roles. A company growing fast creates scope for you faster than you can ask for it.",
  },
  moat: {
    what: "What would stop a well-funded competitor from copying the product tomorrow: network effects, switching costs, proprietary data, scale economies, brand or regulation.",
    why: "Without a moat, success attracts competitors that squeeze prices and growth. A defensible business keeps its value long enough for your equity to vest and pay off.",
  },
  competition: {
    what: "Whether the company is fighting many similar rivals for the same customers (a red ocean) or has carved out uncontested space (a blue ocean), and how it ranks against the leaders.",
    why: "In crowded markets usually one or two winners take most of the value. Being at a likely winner matters more than being at a good company in a crowded field.",
  },
  business_model: {
    what: "How the company makes money and whether each customer is profitable: pricing, gross margin, what it costs to win a customer, and how revenue grows within accounts.",
    why: "Good unit economics mean growth creates value instead of burning cash. Weak economics lead to layoffs and down rounds when funding tightens.",
  },
  gtm: {
    what: "Go-to-market: whether the company knows exactly who its ideal customer is (ICP) and has a repeatable way to reach and sell to them.",
    why: "Many startups with good products stall because they can't sell repeatably. A sharp, repeatable sales motion is what turns PMF into scale.",
  },
  independence: {
    what: "Whether a partner, platform, channel or model provider controls the company's fate (a gatekeeper that could raise prices, copy it or cut it off).",
    why: "A gatekeeper can capture most of the value or end the business overnight. Independence protects the outcome you're betting your time on.",
  },
  risk_retirement: {
    what: "Which of the big risks (technology, market demand, regulation, go-to-market, financing) the company has already eliminated with evidence.",
    why: "Each risk retired raises the odds of success. Knowing which risks remain tells you what could still go wrong after you join.",
  },
  capital: {
    what: "Whether the company has raised the right amount from strong investors for its plan, and uses it efficiently (for example, revenue per employee and runway).",
    why: "Too little money means a scramble; too much too early inflates the valuation and the expectations. Runway decides whether the company survives a bad year.",
  },
  team: {
    what: "Whether the founders are uniquely suited to this problem (founder-market fit) and are building a strong organization that attracts talent.",
    why: "You'll learn most from strong leaders, and the best people attract more of them. Team quality is the best early predictor of how the company handles setbacks.",
  },
  ai_positioning: {
    what: "Whether AI strengthens the company (better product, lower costs, data advantages) or threatens it (AI makes the product easy to copy or replaces it).",
    why: "AI is reshaping most software markets. Companies on the right side of it gain; companies on the wrong side can lose their market quickly.",
  },
  valuation_headroom: {
    what: "How much room today's valuation has to grow: how big a realistic exit is compared to the price you'd join at.",
    why: "Your equity pays off only if the company grows from today's price. A great company priced for perfection can still be a mediocre deal for a new joiner.",
  },
  career_velocity: {
    what: "How fast you'd grow there: headcount growth, new teams and roles opening up, and scope given to people early on.",
    why: "Fast-growing companies create promotions and new responsibilities. Even if the equity doesn't pay off, the experience can.",
  },
};

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

/**
 * What counts as a red flag (team rule, Nov 17): a discrete, verifiable EVENT or CONDUCT a joiner should know about:
 * leadership turnover, layoffs or a down round, lawsuits or regulatory action, governance or ethics problems, or the
 * company's OWN claims shown to be false. NOT red flags: data sources disagreeing (those are "conflicts"), metrics
 * that are merely self-reported or unaudited, and structural business risks the grades already score (competition,
 * dependence on a platform or partner, customer concentration, being pre-revenue).
 * Applied to stored evaluations too, so older flags follow the rule without re-running anything.
 */
const NOT_A_FLAG = /doesn'?t match|does not match|mismatch|inconsisten|disagree|differ(s|ent)? (from|between)|conflicting|self-reported|not (been )?(independently )?(verified|audited|reproduced|disclosed)|unaudited|aggregator|estimate[sd]? (by|from)|reliance|relies on|depend(s|ence|ent) on|competit|pre-revenue|monetization|concentration/i;
export function isRealRedFlag(f: { type?: string; detail?: string | null }): boolean {
  if (f.type === "customer_or_partner_concentration") return false; // scored under Independence and Business model
  if (f.type === "overstated_metrics") return !NOT_A_FLAG.test(f.detail ?? "") || /restat|retract|misstat|fabricat|fraud|inflated/i.test(f.detail ?? "");
  if (f.type && ["leadership_exodus", "layoffs_or_down_round", "legal_or_regulatory", "governance_ethics"].includes(f.type)) return true;
  return !NOT_A_FLAG.test(f.detail ?? "");
}
export const realRedFlags = <T extends { type?: string; detail?: string | null }>(flags: T[] | null | undefined): T[] =>
  (flags ?? []).filter(isRealRedFlag);

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
  // Where it sits on the LTV master table: which fit it has proven, and which experiment it's running now.
  ltv_phase?: "cvp_fit" | "gtm_fit" | "bm_fit" | "scaling" | null;
  ltv_phase_evidence?: string | null;
  playbook?: "network" | "marketplace" | "sales_led_saas" | "plg_saas" | "api_platform" | "b2c_paid" | "hardware" | "services_as_software" | "other" | null;
  liquidity_events?: { type: "tender_offer" | "secondary" | "acquisition_offer" | "ipo_filing"; date?: string | null; detail: string; source?: string | null }[];
  careers_url?: string | null;
  ats?: { provider: "greenhouse" | "lever" | "ashby" | "workable" | "smartrecruiters" | null; slug: string | null } | null;
}

export type Confidence = "low" | "medium" | "high";

export interface DimensionScore {
  score: number; // 1-5 (half points allowed)
  confidence: Confidence;
  rationale: string;
  sources: string[]; // URLs
}

export interface PmfEvidence {
  type: "revenue" | "demand" | "retention" | "usage" | "organic_pull" | "pricing_power" | "investor_signal";
  signal: string;
  value: string;
  as_of?: string | null;
  source?: string | null;
}

export interface EvaluationResult {
  summary: string;
  pmf_evidence: PmfEvidence[]; // non-funding evidence behind the PMF and growth scores
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
}
// Note: the Rocketship List's employee and funding numbers are deliberately NOT passed to the model.
// The list is out of date and anchors the model on wrong figures; it is used only to identify the company.

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
- When sources disagree (e.g. round names, valuations, ARR, total funding), prefer the most recent primary or tier-1 source,
  and record the disagreement in "conflicts". Treat figures that are internally inconsistent (e.g. a growth rate that
  doesn't match the stated ARR history) as unreliable.

Confidence means "how sure am I of this score", not "how much data exists":
- Evidence of absence is evidence. A company that is pre-revenue or just starting commercial launch scores 1-2 on PMF
  and growth with MEDIUM or HIGH confidence. Do not mark it low-confidence just because there is no revenue to report.
- Use LOW confidence only when you genuinely could not find enough information to judge either way.
- Total funding: when sources report different cumulative totals, use the LARGEST credible figure. Totals only grow
  over time, so the larger number usually reflects more recent rounds. Note the smaller figures in "conflicts".
  (Exception: exclude debt facilities and grants if a source clearly labels them as such.)
- Research every number yourself and note the date of your freshest source (as_of).
- Official records in the measured signals outrank aggregators: SEC Form D filings confirm amounts raised and dates
  (still apply the largest-credible-total rule; a filing can lag or split a round), FDA clearances/approvals and
  registered clinical trials are evidence for "risk_retirement" (technical/regulatory risk) and "moat" in health and
  medtech. A pre-revenue company's revenue is KNOWN to be zero: set arr_estimate_usd to 0 rather than leaving it null.

Funding is supporting evidence for product-market fit, never the only evidence (team rule):
- Funding shows what investors believe; PMF is what customers do. Investors can be wrong (the "TechCrunch false
  positive"; Chief raised $100M+ and later shrank). But the PACE of funding carries real information: rounds coming
  quickly, investors pre-empting, or valuations stepping up fast often reflect metrics investors saw privately.
- For "pmf" and "growth", lead with customer evidence and the measured signals provided. You may add funding pace
  (time between rounds, pre-emptive rounds, step-ups) as ONE supporting signal of type "investor_signal".
- Record at least 3 PMF signals in "pmf_evidence", at least 2 of them customer-side (not "investor_signal").
  Without 2 customer-side signals, "pmf" is capped at 3 and gets LOW confidence; say what was missing.
- Round sizes and investor names on their own (without pace) belong only in "capital" and "valuation_headroom".

Red flags are for discrete, verifiable events or conduct only (at most 3, most important first): leadership turnover,
layoffs or a down round, lawsuits or regulatory action, governance or ethics problems, or the company's OWN claims shown
to be false. Do NOT list: disagreements between data sources (put those in "conflicts"), metrics that are merely
self-reported or unaudited, or business risks the grades already cover (competition, platform or partner dependence,
customer concentration, being pre-revenue). An empty list is a good answer when nothing qualifies.`;

export function buildEvaluationPrompt(c: CompanyInput, measuredSignals = ""): string {
  const known = [
    `Name: ${c.name}`,
    c.website && `Website: ${c.website}`,
    c.industry && `Industry: ${c.industry}`,
    c.hq_location && `HQ: ${c.hq_location}`,
    c.founded_year && `Founded: ${c.founded_year}`,
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

## Company identity (from the Rocketship List; use only to identify the company, research every fact yourself)
${known}

${measuredSignals}
## Research (use web search)
Start with what CUSTOMERS do, not what investors do. Find, in this order:
1. Customer evidence (for PMF and growth): ARR/revenue and its growth over time (is it accelerating?); number of customers
   and how it's changing; named customers and published results (case studies with numbers); expansion within accounts,
   renewals, multi-year contracts; review-site ratings and volume (G2, Capterra, TrustRadius, App Store); community size and
   word of mouth (users bringing it to new jobs, agencies or partners built on it); usage signals (downloads, traffic,
   GitHub stars); pricing power (price increases that stuck, paid conversion).
2. Then everything else: latest funding rounds and valuation; headcount and its growth over the last year;
customers and who buys (enterprise/SMB/consumer); pricing model and sales motion; competitors; founders' backgrounds;
key dependencies (platforms, partners, channels, model providers); any red flags (lawsuits, regulatory action,
layoffs, down rounds, leadership departures, governance problems, the company's own claims proven false); work policy and office locations;
whether it sponsors work visas (e.g. H-1B filings); any employee liquidity (tender offers, secondaries);
which LTV phase it's in (CVP fit = proving customers love it; GTM fit = proving repeatable acquisition;
BM fit = proving profitable unit economics; scaling = all three proven); and the careers page. Note whether the careers page is on
Greenhouse (boards.greenhouse.io/<slug> or job-boards.greenhouse.io/<slug>), Lever (jobs.lever.co/<slug>) or Ashby (jobs.ashbyhq.com/<slug>).

## Probability of Winning ("is this a great company?"): score each 1-5
${rubric(WINNING_DIMENSIONS)}

## Joiner Upside ("is joining now a great deal for a new hire?"): score each 1-5
${rubric(JOINER_DIMENSIONS)}

## Output
When you have finished researching, call the submit_evaluation tool. Its input must have exactly this shape:
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
    "ltv_phase": "cvp_fit|gtm_fit|bm_fit|scaling", "ltv_phase_evidence": "one line: what it has proven and what it's working on now",
    "playbook": "network|marketplace|sales_led_saas|plg_saas|api_platform|b2c_paid|hardware|services_as_software|other",
    "liquidity_events": [{"type": "tender_offer|secondary|acquisition_offer|ipo_filing", "date": "YYYY-MM", "detail": "...", "source": "url"}],
    "careers_url": "url"|null, "ats": {"provider": "greenhouse|lever|ashby|workable|smartrecruiters"|null, "slug": "string"|null}
  },
  "scores": {
    ${DIMENSIONS.map(scoreLine).join(",\n    ")}
  },
  "pmf_evidence": [{"type": "revenue|demand|retention|usage|organic_pull|pricing_power|investor_signal", "signal": "what it shows", "value": "the number or fact", "as_of": "YYYY-MM", "source": "url"}],
  "red_flags": [{"type": "governance_ethics|overstated_metrics|leadership_exodus|layoffs_or_down_round|legal_or_regulatory", "severity": "low|medium|high", "detail": "one line", "source": "url"}],
  "conflicts": ["e.g. 'Aggregators label the Feb 2024 round Seed vs Series A; used company blog'"]
}`;
}

// Validate and clamp a model response into an EvaluationResult. Throws on unusable output.
export function parseEvaluation(raw: string): EvaluationResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model output");
  return normalizeEvaluation(JSON.parse(raw.slice(start, end + 1)));
}

/** Validate and clamp an evaluation object (from the submit_evaluation tool or parsed text). */
export function normalizeEvaluation(obj: any): EvaluationResult {
  if (!obj || typeof obj !== "object") throw new Error("Evaluation is not an object");

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
  const red_flags_all: RedFlag[] = Array.isArray(obj.red_flags)
    ? obj.red_flags
        .filter((f: any) => f && typeof f.detail === "string")
        .map((f: any) => ({
          type: f.type,
          severity: severities.includes(f.severity) ? f.severity : "low",
          detail: f.detail,
          source: typeof f.source === "string" ? f.source : null,
        }))
    : [];
  const red_flags = realRedFlags(red_flags_all).slice(0, 3); // team rule: events and conduct only, at most 3
  const pmf_evidence: PmfEvidence[] = Array.isArray(obj.pmf_evidence)
    ? obj.pmf_evidence.filter((e: any) => e && typeof e.value === "string" && typeof e.signal === "string").slice(0, 10)
    : [];
  enforcePmfEvidenceRule(scores, pmf_evidence);
  return {
    summary: String(obj.summary ?? ""),
    pmf_evidence,
    facts: obj.facts ?? {},
    scores,
    red_flags,
    conflicts: Array.isArray(obj.conflicts) ? obj.conflicts.map(String) : [],
  };
}

/**
 * Team rule, enforced in code (not just asked of the model): funding pace may support a PMF score but never carry it.
 * With fewer than 2 customer-side signals, PMF is capped at 3 with low confidence.
 * Returns true if the cap was applied.
 */
export const MIN_CUSTOMER_SIGNALS = 2;
export const PMF_CAP_WITHOUT_CUSTOMER_EVIDENCE = 3;
export function enforcePmfEvidenceRule(scores: Record<DimensionKey, DimensionScore>, evidence: PmfEvidence[]): boolean {
  const customerSide = evidence.filter((e) => e.type !== "investor_signal").length;
  if (customerSide >= MIN_CUSTOMER_SIGNALS || !scores.pmf) return false;
  const pmf = scores.pmf;
  const capped = pmf.score > PMF_CAP_WITHOUT_CUSTOMER_EVIDENCE;
  scores.pmf = {
    ...pmf,
    score: Math.min(pmf.score, PMF_CAP_WITHOUT_CUSTOMER_EVIDENCE),
    confidence: "low",
    rationale: `${pmf.rationale} [Capped: only ${customerSide} customer-side PMF signal(s) found; funding alone can't establish PMF.]`.trim(),
  };
  return capped || pmf.confidence !== "low";
}

// ---------------------------------------------------------------- structured output tool
// The model submits its evaluation through this tool. The API validates the input against the schema and returns it
// as parsed JSON, so a stray quote inside a rationale can't corrupt the output (lesson from the first test batch).
const scoreSchema = {
  type: "object",
  properties: {
    score: { type: "number", minimum: 1, maximum: 5 },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    rationale: { type: "string" },
    sources: { type: "array", items: { type: "string" } },
  },
  required: ["score", "confidence", "rationale", "sources"],
};

export const EVALUATION_TOOL = {
  name: "submit_evaluation",
  description: "Submit the finished LTV evaluation of the company. Call this once, after researching.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      facts: { type: "object" },
      scores: {
        type: "object",
        properties: Object.fromEntries(DIMENSIONS.map((d) => [d.key, scoreSchema])),
        required: DIMENSIONS.map((d) => d.key),
      },
      pmf_evidence: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["revenue", "demand", "retention", "usage", "organic_pull", "pricing_power", "investor_signal"] },
            signal: { type: "string" },
            value: { type: "string" },
            as_of: { type: "string" },
            source: { type: "string" },
          },
          required: ["type", "signal", "value"],
        },
      },
      red_flags: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["governance_ethics", "overstated_metrics", "leadership_exodus", "layoffs_or_down_round", "legal_or_regulatory"] },
            severity: { type: "string", enum: ["low", "medium", "high"] },
            detail: { type: "string" },
            source: { type: "string" },
          },
          required: ["type", "severity", "detail"],
        },
      },
      conflicts: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "facts", "scores", "pmf_evidence", "red_flags", "conflicts"],
  },
};

