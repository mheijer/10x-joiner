# The Next 10x Joiner — PRD (v1)
*LTV Final Project · Fall 2026 · Owner: Marcus Heijer (+ team) · Last updated Nov 10, 2026*
*Read this before building anything. Architecture and timeline live in the build plan; this doc owns **what** and **why**.*

---

## 1. Problem
HBS students recruiting as **joiners** face 556 US "rocketship" startups (Prof. Bussgang's Rocketship List 2026, US tab) and limited recruiting time. Today they shortlist by brand buzz, friends' picks, and scattered TechCrunch, LinkedIn and Crunchbase tabs. Nothing tells them **which of these companies are actually likely to win *and* fit *me*,** or what joining would be worth.

**Job to be done:** *"When recruiting season starts, help me turn a list of 500+ startups into the 5–10 I should actually pursue, ranked for me, so I can spend my time well and defend my choices."*
- Functional: filter, rank and compare quickly.
- Emotional: confidence that I'm not missing the next Wiz or betting on the next Chief.
- Social: be able to explain "why this company" with LTV-grade reasoning.

**Forces of progress:** *Push:* information overload and FOMO. *Pull:* a personalized, framework-backed ranking. *Anxiety:* "can I trust an AI score?" (so we show sources and rationale). *Habit:* spreadsheets plus word of mouth (so we make it faster than a spreadsheet).

## 2. Target user
**Primary:** HBS MBA students (RC and EC) seeking full-time or summer roles at venture-backed startups, mostly in PM, BizOps/strategy, GTM, chief-of-staff or FDE-style roles.
**Not targeting (v1):** engineers looking for IC roles, investors, founders.

## 3. The "aha" moment
> A user describes themselves once and immediately sees **a ranked list and map of companies that fit *their* priorities**, with a one-line reason for each.

Everything in v1 serves getting to that moment in **under 3 minutes**.

## 4. Goals and success metrics (these are the hypotheses we test for the brief)
| # | Hypothesis | Metric | Target |
|---|---|---|---|
| H1 | Personalized ranking changes real shortlists | % of testers who add or drop ≥1 company from their shortlist after a session | ≥ 50% |
| H2 | Personal fit is the pull, not the raw company scores | First thing testers click or sort by; qualitative ranking of features | Fit ranks #1 for most |
| H3 | AI framework scores are directionally right | Rank correlation of AI composite vs. team/expert hand scores on 20 companies | ≥ 0.5 |
| H4 | Must-have | Sean Ellis: "very disappointed" if they couldn't use it | ≥ 40% |

Testers: 10–15 HBS classmates, a 15-minute session each, in Nov 25–Dec 1 week.

## 5. Non-goals (v1)
- Perfect data. **Directionally correct beats precise.** Every number shows its source or is marked as an estimate.
- Applying to jobs in the app. We link out.
- Social features (sharing lists, comments).
- Native mobile app (responsive web is enough).
- Investment advice. The equity estimate is illustrative only.

## 6. Core user journeys
1. **Onboard → aha.** Land → paste a resume or cover letter + "what I'm looking for" (free text plus optional chips: stage, size, sector, location, role) → the app proposes **personal weights** → the user sees a ranked map and list.
2. **Explore.** Pan or zoom the map, apply filters or search → the list and scatter update together → click a pin → company card.
3. **Deep dive.** Company page: personal fit score and why, LTV scorecard with rationale and sources, funding history, open roles, equity estimate.
4. **Bring my own company.** The user adds a startup not on the list (name + website) → evaluation runs (~1–2 min) → it appears on their map, visible only to them.
5. **Tune.** The user adjusts weight sliders → rankings, map colors and scatter re-sort live.

## 7. Requirements by screen

### 7.1 Onboarding / Profile
- Free-text fields: **background** (paste resume or cover letter) and **what I'm looking for**.
- Optional structured chips: stage (Seed–Late), headcount band, sectors, locations / remote, target function.
- **Weights:** start from the defaults (§8). An LLM reads the profile and proposes adjustments with a one-line reason each (e.g. "You emphasized learning and risk tolerance → PMF weight down, Market/Wave up"). The user can accept or edit with sliders.
- No sign-up wall: an anonymous session is created automatically. Optional email link later to keep the profile across devices.

### 7.2 Explore (home): map + list
- Zillow-style split view: **map** (clustered pins; color = personal score) + **ranked list** (name, one-liner, personal score, stage, HQ, # open roles).
- Filters: search text, metro / state, sector, stage, headcount, headcount growth, total funding, customer type, business type, work policy, visa sponsorship, open roles in my function, min personal score, hide red-flagged.
- The map viewport filters the list ("search this area"). Global and remote companies are still listed.

### 7.3 Scatter view
- Default axes: **X = Probability of winning (composite)**, **Y = Personal fit**, **bubble size = total funding**, color = sector.
- Axis dropdowns: any LTV dimension, Joiner Upside, personal score, funding, ARR, revenue per employee, headcount, headcount growth, founded year.
- Quadrant labels (e.g. top-right "Pursue"). Clicking a bubble opens the company. It shares filters with Explore.

### 7.4 Company page
- Header: name, website, HQ, founded, headcount, sector, stage, total funding.
- **Personal fit**: score + 2–3 bullet reasons (and one "watch-out").
- **LTV scorecard**: 10 dimensions, each with score 1–5, confidence, 1–2 sentence rationale and source links. Composite = "probability of winning".
- **Joiner Upside** (valuation headroom, career velocity) and any **red flags** with sources.
- **Key facts**: ARR estimate, revenue per employee, headcount growth, customer type, GTM motion, pricing model, work policy, visa sponsorship. Each is marked fresh or estimated, with an as-of date.
- **Funding**: rounds table (date, round, amount, post-money; estimates flagged).
- **Open roles**: live listings (title, team, location, link), highlighting roles matching the user's target function.
- **Equity estimator** (§9).
- "Re-evaluate" button (rate-limited).

### 7.5 Add a company
- Input: name + website (optional HQ). Dedupe against the seed list. Show progress; on failure, show partial data rather than nothing.

## 8. Scoring model (v2)
Full rationale, course anchors and the worked Sierra example: **[docs/SCORING_FRAMEWORK.md](docs/SCORING_FRAMEWORK.md)**.

- **Probability of Winning (0-100):** 10 dimensions scored 1-5 with confidence: Market & expansion path 15, PMF & customer love (HUNCH) 20, Moat 10, Competitive position 5, Business model & unit economics 10, GTM fit & ICP focus 10, Gatekeeper independence 5, Capital strategy & efficiency 10, Team & velocity 10, AI positioning 5. Low-confidence scores are pulled toward the midpoint. Red flags subtract (high -10, medium -4, capped at -30).
- **Joiner Upside (0-100):** valuation headroom + career velocity. Is joining *at today's price* a good deal?
- **Red flags:** governance and ethics, overstated metrics, exodus, layoffs or down round, legal, concentration (LTV Module 5).
- **Personal score** (what the list is ranked by) = `blend × Winning (with the user's weights) + (1 − blend) × profile fit`, blend 0.5 by default.
  - Weights start from a preset (Balanced, Upside seeker, Safety first, Builder) suggested from the profile, then sliders.
  - Hard preferences (stage, size, growth, location, work policy, visa, sector, customer/business type, open roles in my function) are **filters**, not scores; missing data shows as "unverified".

## 9. Equity estimator
- Inputs (pre-filled, editable): current post-money (latest known or estimated), offer as % or shares + strike, future dilution per round (default 15–20%) and number of rounds to exit, exit scenarios (bear / base / bull values with probabilities), liquidation preference overhang (simple: total preferred raised).
- Output: value of the grant in each scenario plus a probability-weighted expected value, with assumptions shown. Disclaimer: illustrative only, not financial advice.

## 10. Data
- **Seed:** Rocketship List 2026, **US companies only: 556** (`data/rocketship_2026_us.csv`). Mostly SF (166), NYC (87), Palo Alto (36), Boston (17), Austin (14). Columns: name, industry, description, website, HQ, founded, employees (~44% missing), total funding ($M). Non-US companies are out of scope for v1. Users can still add any company themselves.
- **Enrichment per company:** geocode HQ → lat/lng; the evaluation engine (Claude + web search, including TechCrunch and other free sources) → scores and rationale; funding rounds and latest valuation (flagged estimates); careers board detection (Greenhouse, Lever, Ashby, else careers page) → live jobs.
- **Rollout:** evaluate 25 calibration companies first, then all 556. Jobs refresh nightly; evaluations on demand.
- **Source iteration:** each data type has a pluggable source. We log what works in `docs/data-sources.md`.

## 11. Release plan
| Milestone | Date | Done when |
|---|---|---|
| M1 Skeleton | Nov 17 | Deployed URL; seed list loaded and on the map; 25 companies evaluated; calibration set hand-scored |
| M2 Aha | Nov 24 | Onboarding → personal weights → ranked map/list/scatter; company page; US list evaluated |
| M3 Test | Dec 1 | Add-company, jobs, equity estimator; 10–15 user tests done |
| M4 Ship | Dec 6 | Top fixes from testing, Loom recorded, brief submitted |

## 12. Open questions
1. Should the "probability of winning" composite also be user-weighted, or stay fixed as the team's view? (v1: fixed, with personal weights applied in the personal score only.)
2. How do we treat companies with very little public info? (Proposal: low-confidence badge, still ranked.)
3. Show the professor's list provenance in the UI ("Source: Rocketship List 2026")? Check with Jeff/Allison.
4. Budget cap for Claude API on evaluations of all 556 companies (est. $55–280).
