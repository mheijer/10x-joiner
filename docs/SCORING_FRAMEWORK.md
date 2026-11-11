# Scoring Framework (v2): how The Next 10x Joiner applies LTV

*Last updated Nov 10, 2026. The code lives in `lib/rubric.ts` (dimensions, prompt), `lib/scoring.ts` (math), `lib/filters.ts` (preferences) and `lib/facts.ts` (plain facts).*

The design goal: **every number a user sees should trace back to a framework or case from LTV.** The evaluation answers the question the course keeps asking, *"which experiments has this company already won, and which risks are still open?"*, and adds the question a joiner has to answer: *"is joining at today's price a good deal for me?"*

## 1. Three layers, not one score

| Layer | Question | Output | Why it's separate |
|---|---|---|---|
| **Probability of Winning** | Will this company become a 10x company? | 0-100 from 10 weighted dimensions, minus red-flag penalties | This is the company's quality. Users can re-weight it to their risk appetite. |
| **Joiner Upside** | Is joining *now, at this valuation* a good deal for a new hire? | 0-100 from 2 dimensions | A great company at a sky-high price can be a worse bet for a joiner than a good company at a fair price (Paley; valuation equation). Default scatter: Winning vs. Personal Fit, with Joiner Upside as an alternate axis. |
| **Red flags** | Is there anything that should make me pause, whatever the scores say? | A list with severity; high = -10, medium = -4 (capped at -30) | LTV Module 5 (ethics and governance) is a hard filter rather than a trade-off. Rothenberg and Griffith's "one bad apple" readings show that strong-looking numbers can hide rot. |

Plus **facts** (headcount, ARR, customer type, visa sponsorship, ...) that drive filters and personal fit. These are not scored.

## 2. Probability of Winning: the 10 dimensions

The weights follow the course's sequencing logic (*CVP fit → GTM fit → BM fit*, the master table): proof of customer love and a big market dominate, and everything else either protects the win or scales it.

| # | Dimension | The one question | LTV anchors | Weight |
|---|---|---|---|---|
| 1 | **Market, wave & expansion path** | Is the market big, on a real wave, with a path from beachhead to more? | Rachleff's Law; TAM/SAM/SOM bottom-up; Vernal market curve; catching the wave; **bowling pins / lily pads** (C16, Squire, Sprout); Idea Maze | 15 |
| 2 | **PMF level & customer love (HUNCH)** | How far along the PMF levels is it, and is it a must-have? | First Round Levels (Nascent→Extreme); Balfour's 4 checks; **HUNCH**; Sean Ellis 40%; toothbrush test; "usage leads, churn lags" | 20 |
| 3 | **Moat** | If a funded competitor copied it tomorrow, what still protects it? | Helmer's 7 Powers; AI-era moats (memory, workflow, "hidden work"); jobs as moats; avoiding the GPT wrapper (Summer Health) | 10 |
| 4 | **Competitive position** | Winning its category, or stuck in a red ocean? | Blue Ocean; Wiz "blue ocean inside the red"; XYZ Robotics | 5 |
| 5 | **Business model & unit economics** | Does each customer make money, and does it improve with scale? | 10x club / 6-8x / 2-3x tiers; magical elements (NDR, GM); **LTV/CAC by cohort & channel** (Comun); "free pies"; Supernova vs Shooting Star; Fazeshift pricing ladder | 10 |
| 6 | **GTM fit & ICP focus** | Does it know exactly who it sells to, and does the motion match the price? | **"Your ICP is your destiny"**; elephants/deer/mice; Sales Learning Curve; PLG trap (AllSpice, ElevenLabs); FDEs (Blitzy); Clay's ICP commitment | 10 |
| 7 | **Gatekeeper & platform independence** *(new)* | Does a partner, platform, channel or model provider control its fate? | **"Beware gatekeepers"** (Sweet 16 #7); Comun/Unit; TurbineOne/the prime; Blitzy/SIs; AllSpice/procurement; rope-a-dope | 5 |
| 8 | **Capital strategy & efficiency** | Funded well for its plan, and efficient rather than scaling prematurely? | Paley; **premature scaling** (Startup Genome; Chief "blitzflailing"); seedstrapping (BoldVoice); Investor-Market Fit; VC treadmill (XYZ); revenue per employee | 10 |
| 9 | **Team, FMF & velocity** | Do the founders have an earned secret and the speed to out-execute? | Earned secrets (Tavel); founder-market fit and the FMF trap; **Founder Velocity score** (Wiz); "burn the boats"; Bardin | 10 |
| 10 | **AI positioning** | Does AI make it stronger, or is it about to be disrupted? | Copilot vs autopilot (Sequoia); system of record → intelligence (a16z); Supernova vs Shooting Star; Summer Health | 5 |

### What changed from v1, and why
- **HUNCH merged into PMF.** In v1 they double-counted the same evidence. HUNCH is the *evidence* of PMF (Fred Wilson: hunch-driven early, data-driven later), so it now lives inside the PMF score, and PMF's weight rose from 15 to 20.
- **New: Gatekeeper & platform independence.** Gatekeepers came up in more cases than almost any other theme (Comun, TurbineOne, Blitzy, AllSpice) and are a Sweet 16 lesson, yet v1 had no place for them. For AI companies this also covers dependence on frontier-model providers.
- **"Capital & momentum" became "Capital strategy & efficiency".** v1 rewarded big rounds. LTV teaches the opposite as often as not (Paley, Chief, premature scaling, BoldVoice), so a 5 now requires efficiency (revenue per employee, runway) *and* investor quality.
- **Market now includes the expansion path** (bowling pins / lily pads), the Module 3 TAM-expansion lesson.
- **Business model now explicitly includes unit economics done right** (cohorts, channels, marginal CAC), from Comun and the Unit Economics Math slide.
- **GTM now includes ICP focus.** Lesson #1 ("your ICP is your destiny") is the most-repeated idea in the course.
- **Competition dropped from 10 to 5.** Wiz shows a red ocean can be won; moat and PMF capture most of what matters.

### Considered and deliberately left out
- **"Alignment" across CVP/GTM/BM/team/financing** (Module 3): it's real, but too hard to judge from outside the company. It shows up instead in rationales (e.g. a GTM motion that mismatches ACV).
- **Pricing as its own dimension** (Fazeshift): folded into business model to avoid a dimension the AI can rarely verify.
- **Geography / international expansion** (Sprout, Phrase): out of scope for a US-only v1.

## 3. Joiner Upside: the joiner's own question

| Dimension | The one question | LTV anchors |
|---|---|---|
| **Valuation headroom** | At today's price, is there room for a joiner's equity to multiply? | Valuation equation (TAM × penetration × profitability × multiple); BM tiers set the multiple; Paley (big valuations raise the exit bar); Chief ("we raised so much because we could"); Supernova fragility |
| **Career velocity** | Will a new joiner get scope, learning and a résumé-making experience? | 10x Joiner workshop (own metrics, optimize for learning, ride the AI wave); org stages (Hoffman); "avoid titles early"; FDE and GTM-engineer roles; talent density |

The equity estimator (`lib/equity.ts`) puts numbers on valuation headroom. Its default exit scenarios now vary by stage: early companies bust more often but have more room to run, and late-stage companies the reverse.

## 4. Red flags (Module 5)
Types: governance or ethics, overstated metrics ("foie gras effect"), leadership exodus, layoffs or down round, legal or regulatory action, and customer or partner concentration. Each flag shows its source. A red flag lowers the score rather than removing the company: users should see it and decide for themselves.

## 5. Facts, filters and personal fit
Plain attributes, gathered during evaluation. Fresh research overrides the Rocketship List, whose original values are kept in `list_snapshot`.

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

## 6. Worked example: Sierra (Nov 2026, scored by hand with this rubric)
Winning **86.9**, Joiner Upside **75**. Market 5, PMF 5, moat 3.5, competition 3.5, business model 3.5, GTM 4.5, independence 3.5 (sits on top of help desks and depends on model providers), capital 5, team 5, AI 5. Valuation headroom 3: about 40x ARR is priced for continued hypergrowth. Career velocity 5: headcount roughly 4x in a year. Equity: a 0.002% grant has an expected value of about $514K with late-stage defaults. The seed list was stale: it showed $635M raised and 488 employees, against $1.585B and about 700.

## 7. Calibration (PRD hypothesis H3)
`data/calibration.csv` holds 20 companies chosen to stress-test the rubric. They include a head-to-head pair (Sierra vs. Decagon), two LTV companies (Clay, Blitzy), tough tech (Impulse Space, Nuro), sparse-data companies (Mendaera, Bedrock Robotics) and a data-gap case (Postman). Each teammate fills in gut scores *before* seeing the engine's. `npm run calibrate` reports the Spearman rank correlation (target ≥ 0.5) and the five biggest disagreements. Those disagreements are the best material for "What we learned".

## 8. Open questions for the team
1. Should Joiner Upside feed the personal score, or stay a separate axis? (v2: separate.)
2. Are the red-flag penalties (high -10, medium -4) about right?
3. Should competition (5) and AI positioning (5) carry more weight for an AI-heavy list?
