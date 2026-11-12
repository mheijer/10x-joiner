# Scoring Framework (v2.2): how The Next 10x Joiner applies LTV

*Last updated Nov 10, 2026. The code lives in `lib/rubric.ts` (dimensions, prompt), `lib/scoring.ts` (math), `lib/filters.ts` (preferences) and `lib/facts.ts` (plain facts).*

The design goal: **every number a user sees should trace back to a framework or case from LTV.** The evaluation answers the question the course keeps asking, *"which experiments has this company already won, and which risks are still open?"*, and adds the question a joiner has to answer: *"is joining at today's price a good deal for me?"*

## 1. Two scores, plus red flags

**The core distinction: a great company is not always a great deal.**
- **Probability of Winning** asks *"Is this a great company?"* Will it become a 10x company, regardless of who joins or when? This is the investor's question, answered with the course's evaluation frameworks.
- **Joiner Upside** asks *"Is joining it, now, a great deal for **me**?"* The same company can be a worse deal for a new hire if it is priced for perfection (little room for equity to multiply) or no longer gives new people scope and learning. It is the difference between a great company and a great stock *at today's price*.

| | Low Joiner Upside | High Joiner Upside |
|---|---|---|
| **High Probability of Winning** | **Blue chip:** brand and stability, but equity is priced in and roles are narrower | **Pursue:** strong company with room to run |
| **Low Probability of Winning** | **Pass** | **Lottery ticket:** big scope and cheap equity, but real risk |

| Layer | Output | Notes |
|---|---|---|
| Probability of Winning | 0-100 from 12 weighted dimensions | Users can re-weight it to their risk appetite (presets + sliders) |
| Joiner Upside | 0-100 from valuation headroom + career velocity | Kept as its own axis, never blended into Winning |
| Red flags | A list with severity and sources | **The joiner's call.** Flags are always shown but never change a score silently. Users can opt in to a penalty (high -10, medium -4, capped at -30) or hide flagged companies. LTV Module 5: Rothenberg, Griffith's "one bad apple". |

Plus **facts** (headcount, ARR, customer type, visa sponsorship, ...) that drive filters and personal fit. These are not scored.

## 2. Probability of Winning: the 12 dimensions

The weights follow the course's sequencing logic (*CVP fit → GTM fit → BM fit*, the master table): proof of customer love, momentum and a defensible position dominate, and everything else protects or scales the win.

| # | Dimension | The one question | LTV anchors | Weight |
|---|---|---|---|---|
| 1 | **Market, wave & expansion path** | Is the market big, on a real wave, with a path from beachhead to more? | Rachleff's Law; TAM/SAM/SOM bottom-up; Vernal market curve; catching the wave; **bowling pins / lily pads** (C16, Squire, Sprout); Idea Maze | 10 |
| 2 | **PMF, job-to-be-done & customer love (HUNCH)** | What job is the customer hiring it for, is it 10x better than the substitute, and how far along the PMF levels is it? | **Jobs to Be Done** (Forces of Progress); hair-on-fire + **10x better** (Seibel, Thiel); First Round Levels; Balfour's 4 checks; **HUNCH**; Sean Ellis 40%; toothbrush test; "usage leads, churn lags"; Crossing the Chasm false positives | 15 |
| 3 | **Growth momentum** *(new)* | How fast is it growing now, and is growth accelerating? | **T2D3** (Battery) and **Q2T3** (Bessemer); Supernova vs Shooting Star curves; Sales Learning Curve ("AI only scales what already works"); cohort expansion (Sprout) | 10 |
| 4 | **Moat** | If a funded competitor copied it tomorrow, what still protects it? | Helmer's 7 Powers; AI-era moats (memory, workflow, "hidden work"); jobs as moats; avoiding the GPT wrapper (Summer Health) | 10 |
| 5 | **Competitive position** | Winning its category, or stuck in a red ocean? | Blue Ocean; Wiz "blue ocean inside the red"; XYZ Robotics; Sierra vs Decagon | 10 |
| 6 | **Business model & unit economics** | Does each customer make money, and does it improve with scale? | 10x club / 6-8x / 2-3x tiers; magical elements (NDR, GM); **LTV/CAC by cohort & channel** (Comun); "free pies"; Fazeshift pricing ladder | 8 |
| 7 | **GTM fit & ICP focus** | Does it know exactly who it sells to, and does the motion match the price? | **"Your ICP is your destiny"**; elephants/deer/mice; Sales Learning Curve; PLG trap (AllSpice, ElevenLabs); FDEs (Blitzy); Clay | 7 |
| 8 | **Gatekeeper & platform independence** | Does a partner, platform, channel or model provider control its fate? | **"Beware gatekeepers"** (Sweet 16 #7); Comun/Unit; TurbineOne/the prime; Blitzy/SIs; AllSpice/procurement; rope-a-dope | 5 |
| 9 | **Key risks retired** *(new)* | Which big risks (tech, market, GTM, model, regulatory, financing) are behind it, and how bad is the biggest one left? | **C16 Bio** (retire the biggest risk first); "test selection is strategy"; Lean Startup; tough tech as "the sport of kings" (XYZ); Blank's "valley of death" | 5 |
| 10 | **Capital strategy & efficiency** | Funded well for its plan, and efficient rather than scaling prematurely? | Paley; **premature scaling** (Startup Genome; Chief); seedstrapping (BoldVoice); Investor-Market Fit; VC treadmill (XYZ); revenue per employee | 5 |
| 11 | **Team, FMF & 10x org** | Do the founders have an earned secret, the speed to out-execute, and an AI-native organization? | Earned secrets (Tavel); founder-market fit and the FMF trap; **Founder Velocity score** (Wiz); **10x org = AI brain + harness + process** (Sweet 16 #13; "Blitzy building Blitzy"); talent density; "burn the boats"; Bardin | 10 |
| 12 | **AI positioning** | Does AI make it stronger, or is it about to be disrupted? | Copilot vs autopilot (Sequoia); system of record → intelligence (a16z); Supernova vs Shooting Star; Summer Health | 5 |

### What changed from v1, and why
- **HUNCH merged into PMF.** In v1 they double-counted the same evidence. HUNCH is the *evidence* of PMF (Fred Wilson: hunch-driven early, data-driven later), so it now lives inside the PMF score, and PMF's weight rose from 15 to 20.
- **New: Gatekeeper & platform independence.** Gatekeepers came up in more cases than almost any other theme (Comun, TurbineOne, Blitzy, AllSpice) and are a Sweet 16 lesson, yet v1 had no place for them. For AI companies this also covers dependence on frontier-model providers.
- **"Capital & momentum" became "Capital strategy & efficiency".** v1 rewarded big rounds. LTV teaches the opposite as often as not (Paley, Chief, premature scaling, BoldVoice), so a 5 now requires efficiency (revenue per employee, runway) *and* investor quality.
- **Market now includes the expansion path** (bowling pins / lily pads), the Module 3 TAM-expansion lesson.
- **Business model now explicitly includes unit economics done right** (cohorts, channels, marginal CAC), from Comun and the Unit Economics Math slide.
- **GTM now includes ICP focus.** Lesson #1 ("your ICP is your destiny") is the most-repeated idea in the course.
- **Competition kept at 10** (team decision). Most of the list is in crowded AI categories, so position against rivals matters a lot to a joiner.
- **New: Growth momentum.** PMF measures *level* (how far along); growth measures *rate* (how fast, and whether it's accelerating). T2D3 and Q2T3 are explicit course benchmarks, and two companies at the same ARR can be on very different trajectories.
- **New: Key risks retired.** From C16: sequence experiments to retire the biggest risk first. This separates a deep-tech company with an unproven core technology from a SaaS company whose only open risk is execution, which matters for tough tech on the list (Nuro, Impulse Space, Mendaera).

### v2.2 additions from the course-coverage audit
- **JTBD folded into PMF.** Jobs to Be Done was a whole course brief and Sweet 16 lesson #2, but v2.1 only mentioned "jobs as moats". PMF now starts from the job and asks whether the product is 10x better than the closest substitute (Sweet 16 #3). It also warns against early-adopter false positives (Crossing the Chasm).
- **The 10x org folded into Team** (Module 4; Sweet 16 #13): is the company itself AI-native, with high output per person?
- **New facts (shown, not scored):** **LTV phase**, the master-table position (CVP fit → GTM fit → BM fit → scaling) with one line of evidence; **playbook** (Module 3: network, marketplace, sales-led SaaS, PLG, API platform, B2C paid ...); and **employee liquidity events** (tender offers, secondaries; Module 6). Liquidity matters a lot to joiners: Decagon's March 2026 tender offer let 300+ employees sell.

### Considered and deliberately left out
- **"Alignment" across CVP/GTM/BM/team/financing** (Module 3): it's real, but too hard to judge from outside the company. It shows up instead in rationales (e.g. a GTM motion that mismatches ACV).
- **Pricing as its own dimension** (Fazeshift): folded into business model to avoid a dimension the AI can rarely verify.
- **Geography / international expansion** (Sprout, Phrase): out of scope for a US-only v1.

## 3. Joiner Upside: the joiner's own question

| Dimension | The one question | LTV anchors |
|---|---|---|
| **Valuation headroom** | At today's price, is there room for a joiner's equity to multiply? | Valuation equation (TAM × penetration × profitability × multiple); BM tiers set the multiple; Paley (big valuations raise the exit bar); Chief ("we raised so much because we could"); Supernova fragility |
| **Career velocity** | Will a new joiner get scope, learning and a résumé-making experience? | 10x Joiner workshop (own metrics, optimize for learning, ride the AI wave); org stages (Hoffman); "avoid titles early"; FDE and GTM-engineer roles; talent density |

The equity estimator (`lib/equity.ts`) puts numbers on valuation headroom. Default exit scenarios are multiples of *today's* valuation and vary by stage, where stage is judged by traction (PMF score) as well as by round name. Early companies bust more often but have more room to run; late-stage companies are the reverse.

## 4. Red flags (Module 5): the joiner's call
Types: governance or ethics, overstated metrics ("foie gras effect"), leadership exodus, layoffs or down round, legal or regulatory action, and customer or partner concentration. Each flag is shown with its source on the company card and page. **Scores are never adjusted silently.** Each user chooses one of:
- **Show only** (default): see the flags and judge for yourself.
- **Penalize**: subtract from your personal score (high -10, medium -4, capped at -30).
- **Hide**: filter out companies with flags at or above a chosen severity.

## 5. Facts, filters and personal fit
Plain attributes, gathered during evaluation. **Team rules:**
- **The Rocketship List is out of date, so its numbers are never used.** The list only tells us *which* companies to evaluate (name, website, HQ, description). Its headcount and funding figures are not shown to the AI, not displayed and not scored; they're kept in `list_snapshot` for reference only.
- **When sources disagree on total funding, take the larger figure.** Cumulative funding only grows, so the larger number usually reflects more recent rounds. The code also takes the larger of the reported total and the sum of the rounds found. Debt and grants are excluded when clearly labeled.

| Fact | Why it matters to a joiner | Course link | Used as |
|---|---|---|---|
| Stage (Seed/A, B/C, D+) | Risk, equity size, scope | Master table: CVP → GTM → BM fit | Filter + equity defaults |
| Headcount and **12-month headcount growth** | Size preference; growth = career velocity | Org stages (Hoffman) | Filter + fit |
| Total raised, latest valuation, **ARR estimate**, **revenue per employee** | Capital efficiency; valuation headroom | Paley; BoldVoice | Filter + scatter axes |
| **Customer type** (enterprise / mid-market / SMB / consumer / government) | The kind of work and customers | Vernal market curve; elephants/deer/mice | Filter + fit |
| **Business type** (B2B / B2C / marketplace) | Same | Playbooks (Module 3) | Filter + fit |
| **GTM motion** (sales-led / PLG / FDE / channel) | Which roles exist and matter | Sales Learning Curve; PLG trap | Fit |
| **Pricing model** (seat / usage / outcome ...) | AI-era business model signal | Fazeshift ladder; services as software | Display |
| HQ, office locations, **work policy** | Where you'd live | (practical) | Filter |
| **Visa sponsorship** | A dealbreaker for many international HBS students | (practical) | Filter (unknown is flagged, not excluded) |
| Founders (repeat?), top investors | Team quality; investor quality | Earned secrets; diligence your VC (Rothenberg) | Display + fit |
| **Open roles by function** (PM, BizOps, CoS, FDE, GTM, marketing) | Is there a job for *me*? | 10x Joiner roles to consider | Filter + fit |

**How preferences map:** structured chips become **hard filters** (`lib/filters.ts`): stage, size, growth, location, work policy, visa, sector, customer and business type, "must have open roles in my function". Missing data is shown as "unverified" rather than excluding the company. Free text, the résumé and goals feed the **profile-fit** model and the **weight suggestion**, which starts from a preset:

| Preset | For someone who says... | Tilts weight toward |
|---|---|---|
| Balanced (default) | (nothing specific) | Team's LTV view |
| Upside seeker | "I want the next rocketship" | Market, team |
| Safety first | "I need stability / visa / I'm paying off loans" | PMF, business model, capital |
| Builder / learner | "I want to learn from great founders" | Team, AI positioning, GTM |

## 6. Worked examples (Nov 2026, scored by hand with this rubric)

| | Sierra | Decagon | Blitzy | CloudZero | Mendaera |
|---|---|---|---|---|---|
| What | AI customer-service agents | AI customer-service agents (Sierra's #1 rival) | Autonomous enterprise coding (LTV case; Cambridge, MA) | Cloud & AI cost management (Boston) | Handheld medical robot |
| Latest valuation / raised | $15.8B / $1.585B | $4.5B / ~$506M | $1.4B / ~$209M | undisclosed (est. $500M) / ~$119M | undisclosed (est. $320M) / ~$97M |
| Traction | $400M+ ARR | ~$35M ARR (2025 est.), 100+ enterprise logos in 2025 | ~$20M ARR Q1 '26, doubling quarterly (LTV case) | ~$42M ARR (est.) | FDA-cleared; pre-revenue |
| **Probability of Winning** | **85.5** | **72.9** | **70.9** | **60.2** | **47.5** |
| **Joiner Upside** | **75** | **55.3** | **80.3** | **53.8** | **61.3** |
| Quadrant | Pursue | Blue chip-ish (priced high: ~130x ARR) | **Pursue** (best joiner deal of the five) | Middle | Lottery ticket |
| Weakest | Moat, competition, BM | Valuation headroom; PMF/growth vs Sierra | Competition 2.5 (Cognition, Factory, Cursor, Claude Code, Codex); independence 2.5 (model providers are also competitors) | Competition, independence 2.5 | PMF, growth 1.5 |
| Equity EV (example grant) | 0.002% → $482K | 0.01% → $687K | 0.02% → $512K | 0.05% → $473K | 0.1% → $505K (55% chance of $0) |

**Sierra vs Decagon** (same market, same founding year): the rubric separates them by 12.6 points. The gaps are in PMF (+1), growth (+1) and half-points across moat, competition, GTM, risk, capital and team. Decagon wins on independence (it runs ~80% of inference on its own fine-tuned models). For a joiner, Decagon's ~130x revenue multiple drags its upside well below Sierra's.

**Blitzy vs the course:** the rubric's weak spots (moat 3, competition 2.5, independence 2.5) match the open question the instructors raised in class: *is the moat durable?*

### What the walkthroughs taught us (and what we changed)
1. **The seed list is stale or wrong in places.** Sierra: 488 employees and $635M listed vs ~700 and $1.585B. Mendaera: 4 employees listed vs ~20. → The list's numbers are no longer used at all; it only identifies companies.
2. **Sources disagree a lot for smaller companies.** CloudZero's total funding ranges from $56M to $119M across sites, and one research estimate ("757% YoY") doesn't match its own ARR history. → Source hierarchy, a `conflicts` field, an instruction to distrust internally inconsistent figures, and a rule to take the **larger** funding total (it's usually the more recent).
3. **Stage labels mislead.** Mendaera is "Series B" but pre-revenue, so mid-stage exit odds made its equity look better than Sierra's. → Stage is now judged by traction (PMF score) as well as by round name: the course's "TechCrunch false positive" lesson.
4. **Exit multiples were double-counting success.** They were applied on top of a valuation that already assumed future rounds. → Exits are now multiples of *today's* valuation.
4b. **Future rounds were assumed in every scenario.** A "modest" exit at today's valuation was charged the dilution and liquidation preferences of three later up-rounds, which made it pay $0. → Each scenario now only counts rounds priced below its exit value. (An earlier note that Mendaera's modest exit "pays $0 because of preferences" was this bug, not a real effect. Preferences only bite when the exit is below the total preference stack.)
5. **"Low confidence" was rewarding unknowns.** Pulling uncertain scores toward 3 lifted a pre-revenue company's growth from 1.5 to 2.1. → The prompt now treats evidence of absence (no revenue yet) as evidence; low confidence is only for genuinely unknown.
6. **Job coverage has gaps.** Smaller medtech/hardware companies often don't use Greenhouse, Lever or Ashby. → They fall back to a careers-page link. Coverage is worth measuring after the first batch.
7. **Valuations are usually undisclosed below late stage.** Both CloudZero and Mendaera need estimated valuations, so the equity estimator must show "estimate" clearly and let users edit it.

## 7. Data sources: what feeds each score

**Team rule: funding is not evidence of PMF.** Funding shows what investors believe; PMF is what customers do (the "TechCrunch false positive"; Chief). Funding, valuations and investor names count only toward **Capital** and **Valuation headroom**. PMF and Growth must rest on customer evidence. Each evaluation must record at least 3 non-funding PMF signals in `pmf_evidence`; otherwise PMF gets low confidence.

**Three kinds of input:**

| Kind | Where it comes from | How reliable |
|---|---|---|
| **Measured signals** (`lib/signals.ts`), pulled by code before the AI runs | Company job board (Greenhouse/Lever/Ashby), Hacker News (Algolia API), Apple App Store (iTunes API), GitHub API, npm & PyPI download APIs | Exact numbers with dates, but each only fits some companies (App Store → consumer apps; GitHub/npm/PyPI → dev tools; HN → tech audiences, and it can echo funding news) |
| **Researched evidence**, found by the AI with web search and cited by URL | Company site/blog/case studies, SEC filings, tier-1 press, research firms (Sacra etc.), review sites (G2, Capterra), aggregators (last resort) | Ranked by the source hierarchy; conflicts logged |
| **Judgment**, the AI's 1-5 grade per dimension | The rubric anchors applied to the two kinds above | Shown with confidence, rationale and sources so users can check it |

**By dimension:**

| Dimension | Main evidence | Never used |
|---|---|---|
| PMF & JTBD | Revenue/ARR disclosures; customer counts and named results; renewals and expansion; review ratings and volume; usage signals; word of mouth | Funding, valuation, investors |
| Growth momentum | Revenue over time; customer-count growth; hiring growth and customer-facing hiring share; usage/mention trends (year over year) | Round step-ups |
| Market | Market-size research, category growth, adjacent products | |
| Moat, Competition | Product depth, integrations, competitor revenue/customers, comparison coverage | |
| Business model | Pricing pages, pricing model, margins (if disclosed), expansion revenue | |
| GTM | Deal sizes, sales motion, job-board role mix (sales vs FDE vs PLG growth roles) | |
| Independence, Risks retired | Platform/partner/model dependencies; regulatory status (e.g. FDA); technical proof points | |
| Capital | Funding rounds, investors, time since last raise, revenue per employee | |
| Team | Founder backgrounds and prior exits, leadership changes, output per person | |
| Valuation headroom | Latest valuation vs revenue, growth and peers | |
| Career velocity | Headcount growth, open roles, company stage | |

**What we don't use:** LinkedIn (its terms prohibit scraping), paid databases (PitchBook, Crunchbase Pro, Similarweb), and the Rocketship List's numbers.

## 8. Calibration (PRD hypothesis H3)
`data/calibration.csv` holds 20 companies chosen to stress-test the rubric. They include a head-to-head pair (Sierra vs. Decagon), two LTV companies (Clay, Blitzy), tough tech (Impulse Space, Nuro), sparse-data companies (Mendaera, Bedrock Robotics) and a data-gap case (Postman). Each teammate fills in gut scores *before* seeing the engine's. `npm run calibrate` reports the Spearman rank correlation (target ≥ 0.5) and the five biggest disagreements. Those disagreements are the best material for "What we learned".

## 9. Open questions for the team
1. Should Joiner Upside feed the personal score, or stay a separate axis? (v2: separate.)
2. Are the red-flag penalties (high -10, medium -4) about right?
3. Should AI positioning (5) carry more weight for an AI-heavy list?
