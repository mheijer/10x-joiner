// Compare the engine's rankings to the team's gut rankings on data/calibration.csv.
// 1. Each teammate fills team_gut_* columns (0-100) WITHOUT looking at the engine's scores.
// 2. Run evaluations:  npm run seed -- --evaluate --dry-run --only "<name>"  (or evaluate all into Supabase)
// 3. npm run calibrate
// Reports Spearman rank correlation (target ≥ 0.5, PRD hypothesis H3) and the biggest disagreements,
// which are the best material for "What we learned" in the brief.
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { joinerUpside } from "../lib/scoring.ts";
import { ranks, spearman } from "../lib/stats.ts";

const rows: any[] = parse(fs.readFileSync("data/calibration.csv", "utf8"), { columns: true, skip_empty_lines: true });
const dir = "data/eval_samples";
const engine = new Map<string, { winning: number; joiner: number }>();
for (const r of rows) {
  const f = path.join(dir, r.name.replace(/[^a-z0-9]+/gi, "_") + ".json");
  if (!fs.existsSync(f)) continue;
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  engine.set(r.name, { winning: j.composite, joiner: joinerUpside(j.result.scores) });
}

for (const [label, gutCol, key] of [["Probability of Winning", "team_gut_winning_0_100", "winning"], ["Joiner Upside", "team_gut_joiner_upside_0_100", "joiner"]] as const) {
  const pairs = rows.filter((r) => r[gutCol] !== "" && engine.has(r.name)).map((r) => ({ name: r.name, gut: Number(r[gutCol]), eng: engine.get(r.name)![key] }));
  if (pairs.length < 5) { console.log(`${label}: need ≥5 companies with both gut and engine scores (have ${pairs.length}).`); continue; }
  const rho = spearman(pairs.map((p) => p.gut), pairs.map((p) => p.eng));
  console.log(`\n${label}: Spearman ρ = ${rho.toFixed(2)} over ${pairs.length} companies (target ≥ 0.50)`);
  const gr = ranks(pairs.map((p) => -p.gut)), er = ranks(pairs.map((p) => -p.eng));
  pairs.map((p, i) => ({ ...p, gutRank: gr[i], engRank: er[i], gap: Math.abs(gr[i] - er[i]) }))
    .sort((a, b) => b.gap - a.gap).slice(0, 5)
    .forEach((p) => console.log(`  ${p.name}: team #${p.gutRank} (${p.gut}) vs engine #${p.engRank} (${p.eng})`));
}
