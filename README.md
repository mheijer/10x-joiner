# The Next 10x Joiner

A map-first startup explorer for HBS joiners. It scores the US companies on Prof. Bussgang's Rocketship List 2026 with LTV frameworks, ranks them against each user's profile, and estimates what joining could be worth.

**LTV Final Project, Fall 2026. Due Mon Dec 7, 8am.**

## Start here
1. Read **[PRD.md](PRD.md)**. It's the source of truth for *what* we're building and *why*.
2. Check the build plan and timeline in the "LTV Final Project" Claude project.
3. Log any AI tool use in **[AI_USAGE.md](AI_USAGE.md)** as you go (the brief requires precise disclosure).

## What's in the repo
| Path | What it is |
|---|---|
| `PRD.md` | Product requirements: users, journeys, screens, scoring model |
| `data/rocketship_2026_us.csv` | Seed list: 556 US companies |
| `supabase/schema.sql` | Database tables plus privacy rules (run once in Supabase) |
| `.env.example` | Keys you need locally (copy to `.env.local`) |

## Stack
Next.js (on Vercel) · Supabase (Postgres + anonymous auth) · Claude API with web search (evaluation engine) · MapLibre (map) · Recharts (scatter)

## Getting set up locally
You need Node 20+ and git.
```bash
git clone https://github.com/mheijer/10x-joiner.git
cd 10x-joiner
npm install
cp .env.example .env.local   # ask Marcus for the keys
npm run dev                  # http://localhost:3000
```

## Working together
- Don't commit to `main` directly. Create a branch (`git checkout -b feature/map`), push it, and open a pull request.
- Never commit `.env.local` or any API keys.
- If you use Claude Code, point it at `PRD.md` first so it builds to the spec.

## Running the data pipeline (in the cloud, no setup)
Everything runs on GitHub's computers: **Actions tab → "Run pipeline" → Run workflow**, then pick a task
(load, test-batch, jobs, evaluate, calibrate). Keys live in **Settings → Secrets and variables → Actions**:
`ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
Every pull request also runs the **Build check** (logic tests, type check, app build).

## Running evaluations (and what they cost)
Model: **Claude Opus 5.5** by default (team decision). Each evaluation is ~$0.30-0.60 (tokens + ~6 web searches at $0.01 each).
The seed script prints the running cost and a projection for all 556 companies. Account limit: **$50/month** (Anthropic Console).
```bash
npm run seed -- --load        # load the 556 companies + map locations (free, ~5 min)
npm run test-batch            # FIRST RUN: 12 test companies on Opus, ~$4-7, hard stop at $10
npm run seed -- --jobs        # pull job listings + posted salaries (free)
npm run calibrate             # compare engine scores with the team's gut scores (data/calibration.csv)
```
Test batch: Sierra, Decagon, Crescendo (leader / #2 / small challenger in one market), Blitzy, Clay (LTV companies), CloudZero (mid-stage SaaS), knownwell (small Boston-area AI), Mendaera (pre-revenue
medtech), Cursor (dev-tool hypergrowth), Nuro (deep tech), WHOOP (consumer hardware), Bedrock Robotics (sparse info).
Runs are capped at 20 companies unless you pass --all. Data is a snapshot: nothing refreshes automatically; re-run with
`--force` (evaluations) or `--jobs` (job listings) when you decide to update.
