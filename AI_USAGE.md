# AI Usage Log

The LTV final project requires precise disclosure of which AI tools we used and how. Add a line whenever you use one, and note what worked and what didn't, since the brief should reflect on tool quality.

| Date | Who | Tool | What we used it for | Quality notes |
|---|---|---|---|---|
| 2026-11-10 | Marcus | Claude (Opus) | Read the assignment; drafted the build plan and PRD; converted the seed list; wrote the DB schema; created this repo | |
| 2026-11-10 | Marcus | Claude (Opus) | Wrote the LTV scoring rubric, scoring math, equity estimator, job-board fetchers, geocoder, evaluation engine, seed pipeline and evaluate API; unit-checked the pure logic | Untested end to end until API and Supabase keys are added |
| 2026-11-10 | Marcus | Claude (Opus) | Walked Sierra through the pipeline by hand (web search + rubric); found stale list data, conflicting aggregator sources and stage-blind exit odds; redesigned the rubric (v2) against LTV frameworks | Aggregator sites often conflict with primary sources; hand walkthrough was worth it before scaling |
| 2026-11-10 | Marcus | Claude (Opus) | Hand-walked CloudZero and Mendaera through rubric v2.1; found stage-label and exit-multiple bugs in equity defaults and a confidence-shrink bias; fixed all three | Smaller companies: heavy source conflicts, stale list data, no disclosed valuations |
| 2026-11-12 | Marcus | Claude (Opus) | Hand-scored Decagon and Blitzy; found and fixed a scenario bug (future rounds assumed even in modest exits) | Rubric separated Sierra vs Decagon by 12.6 pts; Blitzy weak spots matched the in-class open question |
| 2026-11-12 | Marcus | Claude (Opus) | Separated PMF evidence from fundraising: added measured signals from free APIs and a funding-is-not-PMF rule; live-tested the Hacker News signal (sierra.ai 23 stories vs decagon.ai 1) | HN is noisy for enterprise companies and can echo funding news |
| 2026-11-12 | Marcus | Claude (Opus) | Added posted salary ranges from job boards, a hiring profile (focus as a growth datapoint), and an equity package estimate from financials + posted pay; verified Ashby compensation fields live on CloudZero | Grant-size multiples are rules of thumb, not market data |
| 2026-11-12 | Marcus | Claude (Opus) | Budget guardrails: 20-company cap per evaluation run (unless --all), 3 added startups per user (API + DB trigger), manual-only data refresh | |
| 2026-11-12 | Marcus | Claude (Opus) | Redesigned personal fit: one Sonnet call per user to parse the profile, plain-math fit across all companies, AI explanations only on companies opened (~\$0.20/user instead of ~\$4.45) | |
