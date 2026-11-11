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
