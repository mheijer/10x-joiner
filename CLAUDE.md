# The Next 10x Joiner: notes for Claude Code

Read `PRD.md` before building any feature. It defines the user (HBS joiners), the "aha" moment (a personal ranking), the screens, and the scoring model. Don't add features that are listed as non-goals.

## Architecture
- Next.js App Router + TypeScript, deployed on Vercel. Supabase for Postgres, anonymous auth and row-level security (`supabase/schema.sql`).
- `lib/rubric.ts` is the **single source of truth** for the 12 Probability-of-Winning dimensions, 2 Joiner Upside dimensions, default weights, the evaluation prompt and output parsing. Change scoring here only.
- `lib/scoring.ts`: pure math (Probability of Winning, Joiner Upside, red-flag penalties, presets, personal score). Keep it pure.
- `lib/filters.ts` (hard preference filters), `lib/facts.ts` (facts → columns; fresh beats list), `lib/stats.ts` (calibration math): all pure.
- Why each dimension exists and which LTV framework it maps to: `docs/SCORING_FRAMEWORK.md`. Update it whenever the rubric changes.
- `lib/signals.ts`: free public-API traction signals (job board, Hacker News, App Store, GitHub, npm, PyPI), gathered before each evaluation.
- `lib/fitmath.ts`: personal fit as plain math (pure, free, explainable). AI is used only in `lib/fit.ts`: `parseProfile` (once per user) and `explainFit` (per company opened, cached). Never call the AI per company per user.
- `lib/personal.ts`: client-side personalization (profile state, personal score per company, which metric the list/map shows, first equity estimate). Pure. Team default weights stay the baseline until the user applies their own.
- `lib/hiring.ts`: hiring profile (roles by function, hiring focus, posted salary bands). Pure.
- `lib/equity.ts`: pure equity estimator and `estimatePackage` (grant estimate from financials + posted salary). `lib/jobs.ts`: Greenhouse/Lever/Ashby public boards. `lib/geocode.ts`: HQ → lat/lng.
- `lib/claude.ts`, `lib/evaluate.ts`, `lib/fit.ts`: Claude API calls (server-only). `lib/supabase-admin.ts`: service-role client (server-only).
- `scripts/seed.ts`: batch pipeline (`--load`, `--evaluate`, `--jobs`, `--dry-run`).

## Conventions
- Relative imports inside `lib/` and `scripts/` use explicit `.ts` extensions (so they run under `tsx`/node). App code may use the `@/` alias.
- Never import server-only modules (`claude`, `evaluate`, `fit`, `supabase-admin`) into client components.
- Every number shown in the UI must show its source or be flagged as an estimate.
- Data only needs to be directionally correct. Prefer shipping over perfecting sources.
- Never use the Rocketship List's numbers (headcount, funding): the list is out of date. It only identifies companies.
- When sources disagree on total funding, use the larger figure (it's usually the more recent).
- Funding pace supports PMF but never carries it: PMF needs at least 2 customer-side signals, or it is capped at 3 with low confidence (enforced in `enforcePmfEvidenceRule`, `lib/rubric.ts`).
- Log notable AI tool usage in `AI_USAGE.md` (required for the course brief).
- Work on a branch and open a PR. Never commit `.env.local`.
