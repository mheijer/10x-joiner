// Print evaluated companies from Supabase: scores per dimension, facts, PMF evidence, red flags, conflicts.
// Free (no AI calls). Usage: npx tsx scripts/report.ts [--only "Sierra,CloudZero"]
import { config } from "dotenv";
config({ path: ".env.local" });
import { supabaseAdmin } from "../lib/supabase-admin.ts";
import { DIMENSIONS } from "../lib/rubric.ts";
import { joinerUpside } from "../lib/scoring.ts";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : "";
const names = new Set(only.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
const short = (s: unknown, n = 140) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);
const usd = (x: any) => (x == null ? "?" : x >= 1e9 ? `$${(x / 1e9).toFixed(2)}B` : `$${Math.round(x / 1e6)}M`);

(async () => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("evaluations")
    .select("composite, joiner_upside, scores, summary, red_flags, conflicts, pmf_evidence, signals, model, status, created_at, companies(name, hq_city, stage, headcount, total_funding_usd, latest_post_money_usd, arr_estimate_usd, ltv_phase, playbook, sponsors_visas, work_policy, facts_as_of)")
    .eq("status", "done")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const seen = new Set<string>();
  for (const e of data ?? []) {
    const c: any = (e as any).companies;
    if (!c || seen.has(c.name) || (names.size && !names.has(c.name.toLowerCase()))) continue;
    seen.add(c.name);
    console.log(`\n=== ${c.name} | Winning ${e.composite} | Joiner Upside ${e.joiner_upside ?? joinerUpside(e.scores as any)} | ${e.model} | ${String(e.created_at).slice(0, 10)}`);
    console.log(`Summary: ${short(e.summary, 400)}`);
    console.log(`Facts (as of ${c.facts_as_of ?? "?"}): ${c.stage ?? "?"} | ${c.hq_city ?? "?"} | ~${c.headcount ?? "?"} people | raised ${usd(c.total_funding_usd)} | valuation ${usd(c.latest_post_money_usd)} | ARR ${usd(c.arr_estimate_usd)} | LTV phase ${c.ltv_phase ?? "?"} | playbook ${c.playbook ?? "?"} | visas ${c.sponsors_visas} | ${c.work_policy ?? "?"}`);
    for (const d of DIMENSIONS) {
      const s = (e.scores as any)[d.key];
      if (s) console.log(`  ${d.key.padEnd(18)} ${String(s.score).padEnd(4)} ${s.confidence.padEnd(6)} ${short(s.rationale, 220)}`);
    }
    for (const p of (e.pmf_evidence as any[]) ?? []) console.log(`  PMF evidence [${p.type}] ${short(p.signal, 70)}: ${short(p.value, 80)}`);
    for (const f of (e.red_flags as any[]) ?? []) console.log(`  RED FLAG [${f.severity}] ${short(f.detail, 160)}`);
    for (const x of (e.conflicts as any[]) ?? []) console.log(`  Conflict: ${short(x, 180)}`);
    for (const s of (e.signals as any[]) ?? []) console.log(`  Signal: ${short(s.metric, 60)} = ${short(s.value, 80)}`);
  }
  console.log(`\n${seen.size} evaluated companies.`);
})();
