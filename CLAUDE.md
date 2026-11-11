# The Next 10x Joiner: notes for Claude Code

Read `PRD.md` before building any feature. It defines the user (HBS joiners), the "aha" moment (a personal ranking), the screens, and the scoring model. Don't add features that are listed as non-goals.

## Architecture
- Next.js App Router + TypeScript, deployed on Vercel. Supabase for Postgres, anonymous auth and row-level security (`supabase/schema.sql`).
- `lib/rubric.ts` is the **single source of truth** for the 10 LTV dimensions, default weights, the evaluation prompt and output parsing. Change scoring here only.
- `lib/scoring.ts`: pure math (composite, confidence shrinkage, personal score). Keep it pure.
- `lib/equity.ts`: pure equity estimator. `lib/jobs.ts`: Greenhouse/Lever/Ashby public boards. `lib/geocode.ts`: HQ → lat/lng.
- `lib/claude.ts`, `lib/evaluate.ts`, `lib/fit.ts`: Claude API calls (server-only). `lib/supabase-admin.ts`: service-role client (server-only).
- `scripts/seed.ts`: batch pipeline (`--load`, `--evaluate`, `--jobs`, `--dry-run`).

## Conventions
- Relative imports inside `lib/` and `scripts/` use explicit `.ts` extensions (so they run under `tsx`/node). App code may use the `@/` alias.
- Never import server-only modules (`claude`, `evaluate`, `fit`, `supabase-admin`) into client components.
- Every number shown in the UI must show its source or be flagged as an estimate.
- Data only needs to be directionally correct. Prefer shipping over perfecting sources.
- Log notable AI tool usage in `AI_USAGE.md` (required for the course brief).
- Work on a branch and open a PR. Never commit `.env.local`.
