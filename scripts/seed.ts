// Seed + enrichment pipeline for the Rocketship List (US).
//
//   npm run seed -- --load                       # insert companies + geocode HQs into Supabase
//   npm run seed -- --evaluate --limit 25        # LTV-evaluate companies not yet evaluated
//   npm run seed -- --evaluate --only "Sierra"   # (re-)evaluate one company
//   npm run seed -- --evaluate --limit 5 --dry-run   # no database: writes JSON to data/eval_samples/
//   npm run seed -- --evaluate --dry-run --calibration  # evaluate the 20 calibration companies, then: npm run calibrate
//   npm run seed -- --jobs                       # refresh live job listings
//
// Flags: --force (re-evaluate even if done), --concurrency 3
import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { evaluateCompany } from "../lib/evaluate.ts";
import { normalizeUsLocation, geocodeUs } from "../lib/geocode.ts";
import { discoverJobs, classifyRole, countByFunction, boardUrl } from "../lib/jobs.ts";
import { collectSignals } from "../lib/signals.ts";
import type { Signal } from "../lib/signals.ts";
import { factsToCompanyUpdate } from "../lib/facts.ts";
import { joinerUpside } from "../lib/scoring.ts";
import type { AtsProvider } from "../lib/jobs.ts";
import type { CompanyInput } from "../lib/rubric.ts";

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const opt = (f: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
const LIMIT = Number(opt("--limit") ?? Infinity);
const ONLY = opt("--only");
const CONCURRENCY = Number(opt("--concurrency") ?? 3);
const DRY = flag("--dry-run");

interface Row {
  name: string;
  industry: string;
  description: string;
  website: string;
  hq_location: string;
  founded_year: string;
  employees: string;
  total_funding_musd: string;
}

function loadCsv(): Row[] {
  const file = path.join(process.cwd(), "data/rocketship_2026_us.csv");
  return parse(fs.readFileSync(file, "utf8"), { columns: true, skip_empty_lines: true });
}

const num = (s: string) => (s && !isNaN(Number(s)) ? Number(s) : null);
const domainOf = (w: string) => (w ? w.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : null);

async function pool<T>(items: T[], n: number, fn: (t: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx], idx);
      }
    }),
  );
}

// ---------------------------------------------------------------- load + geocode
async function load() {
  const { supabaseAdmin } = await import("../lib/supabase-admin.ts");
  const db = supabaseAdmin();
  const rows = loadCsv();
  const cacheFile = path.join(process.cwd(), "data/geocache.json");
  const cache: Record<string, { lat: number; lng: number } | null> = fs.existsSync(cacheFile)
    ? JSON.parse(fs.readFileSync(cacheFile, "utf8"))
    : {};

  const { data: existing } = await db.from("companies").select("name").eq("is_seed", true);
  const have = new Set((existing ?? []).map((r: any) => r.name));

  let added = 0;
  for (const r of rows) {
    if (have.has(r.name)) continue;
    const hq = normalizeUsLocation(r.hq_location);
    if (hq && !(hq in cache)) {
      cache[hq] = await geocodeUs(hq);
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
      await new Promise((res) => setTimeout(res, 1100)); // Nominatim: 1 req/sec
    }
    const geo = hq ? cache[hq] : null;
    const { error } = await db.from("companies").insert({
      name: r.name,
      domain: domainOf(r.website),
      description: r.description || null,
      sector: r.industry || null,
      hq_city: hq,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      founded_year: num(r.founded_year),
      // List headcount/funding are out of date: kept for reference only, never shown or scored.
      list_snapshot: { employees: num(r.employees), total_funding_musd: num(r.total_funding_musd), hq_location: r.hq_location, source: "Rocketship List 2026" },
      is_seed: true,
    });
    if (error) console.error(r.name, error.message);
    else added++;
  }
  console.log(`Loaded ${added} new companies (${rows.length} in list).`);
}

// ---------------------------------------------------------------- measured signals (non-funding evidence)
async function gatherSignals(name: string, domain?: string | null): Promise<Signal[]> {
  const hit = await discoverJobs(name, domain).catch(() => null);
  return collectSignals({
    name,
    domain,
    jobsByFunction: hit ? countByFunction(hit.jobs) : undefined,
    jobBoardUrl: hit ? boardUrl(hit.provider, hit.slug) : undefined,
  }).catch(() => []);
}

// ---------------------------------------------------------------- evaluate
async function evaluate() {
  if (DRY) return evaluateDry();
  const { supabaseAdmin } = await import("../lib/supabase-admin.ts");
  const db = supabaseAdmin();

  let q = db.from("company_latest").select("*").eq("is_seed", true).order("name");
  if (ONLY) q = q.ilike("name", ONLY);
  const { data, error } = await q;
  if (error) throw error;
  const todo = (data ?? []).filter((c: any) => flag("--force") || ONLY || c.eval_status !== "done").slice(0, LIMIT);
  console.log(`Evaluating ${todo.length} companies (concurrency ${CONCURRENCY})...`);

  let done = 0;
  await pool(todo, CONCURRENCY, async (c: any) => {
    const input: CompanyInput = {
      name: c.name,
      website: c.domain,
      description: c.description,
      industry: c.sector,
      hq_location: c.hq_city,
      founded_year: c.founded_year,
    };
    try {
      const signals = await gatherSignals(c.name, c.domain);
      const { result, composite, model } = await evaluateCompany(input, signals);
      const f = result.facts ?? {};
      await db.from("evaluations").insert({
        company_id: c.id,
        scores: result.scores,
        composite,
        joiner_upside: joinerUpside(result.scores),
        red_flags: result.red_flags,
        conflicts: result.conflicts,
        pmf_evidence: result.pmf_evidence,
        signals,
        summary: result.summary,
        model,
        status: "done",
      });
      // All numbers come from fresh research; list values live only in list_snapshot.
      await db.from("companies").update(factsToCompanyUpdate(f, c)).eq("id", c.id);
      if (f.funding_rounds?.length) {
        await db.from("funding_rounds").delete().eq("company_id", c.id);
        await db.from("funding_rounds").insert(
          f.funding_rounds.map((r) => ({
            company_id: c.id,
            round: r.round,
            announced_on: r.date ? (r.date.length === 7 ? `${r.date}-01` : r.date) : null,
            amount_usd: r.amount_usd ?? null,
            post_money_usd: r.post_money_usd ?? null,
            post_money_is_estimate: !r.post_money_usd,
            source_url: r.source ?? null,
          })),
        );
      }
      console.log(`[${++done}/${todo.length}] ${c.name}: ${composite}`);
    } catch (e: any) {
      console.error(`[${++done}/${todo.length}] ${c.name}: FAILED ${e.message}`);
      await db.from("evaluations").insert({ company_id: c.id, scores: {}, status: "error", summary: e.message });
    }
  });
}

/** No database needed: evaluate the first N (or --only) companies from the CSV and write JSON files. */
async function evaluateDry() {
  const outDir = path.join(process.cwd(), "data/eval_samples");
  fs.mkdirSync(outDir, { recursive: true });
  let rows = loadCsv();
  if (ONLY) rows = rows.filter((r) => r.name.toLowerCase() === ONLY.toLowerCase());
  if (flag("--calibration")) {
    const cal: { name: string }[] = parse(fs.readFileSync("data/calibration.csv", "utf8"), { columns: true });
    const names = new Set(cal.map((c) => c.name.toLowerCase()));
    rows = rows.filter((r) => names.has(r.name.toLowerCase()));
  }
  rows = rows.slice(0, LIMIT === Infinity ? (flag("--calibration") ? rows.length : 5) : LIMIT);
  console.log(`Dry run: evaluating ${rows.length} companies -> data/eval_samples/`);
  await pool(rows, CONCURRENCY, async (r) => {
    try {
      const signals = await gatherSignals(r.name, domainOf(r.website));
      const out = await evaluateCompany(
        {
          name: r.name, website: r.website, description: r.description, industry: r.industry,
          hq_location: r.hq_location, founded_year: r.founded_year,
        },
        signals,
      );
      const file = path.join(outDir, r.name.replace(/[^a-z0-9]+/gi, "_") + ".json");
      fs.writeFileSync(file, JSON.stringify(out, null, 2));
      console.log(`${r.name}: winning ${out.composite} | joiner upside ${joinerUpside(out.result.scores)} | measured signals ${signals.length} | PMF evidence ${out.result.pmf_evidence.length} | red flags ${out.result.red_flags.length}`);
    } catch (e: any) {
      console.error(`${r.name}: FAILED ${e.message}`);
    }
  });
}

// ---------------------------------------------------------------- jobs
async function jobs() {
  const { supabaseAdmin } = await import("../lib/supabase-admin.ts");
  const db = supabaseAdmin();
  let q = db.from("companies").select("id,name,domain,ats_provider,ats_slug").eq("is_seed", true);
  if (ONLY) q = q.ilike("name", ONLY);
  const { data } = await q;
  const list = (data ?? []).slice(0, LIMIT);
  let found = 0;
  await pool(list, 5, async (c: any) => {
    const hit = await discoverJobs(c.name, c.domain, { provider: c.ats_provider as AtsProvider | null, slug: c.ats_slug });
    if (!hit) return;
    found++;
    await db.from("jobs").delete().eq("company_id", c.id);
    await db.from("jobs").insert(hit.jobs.map((j) => ({ company_id: c.id, ...j, job_function: classifyRole(j.title) })));
    await db.from("companies").update({ ats_provider: hit.provider, ats_slug: hit.slug }).eq("id", c.id);
  });
  console.log(`Jobs: found boards for ${found}/${list.length} companies.`);
}

(async () => {
  if (flag("--load")) await load();
  if (flag("--evaluate")) await evaluate();
  if (flag("--jobs")) await jobs();
  if (!["--load", "--evaluate", "--jobs"].some(flag)) console.log("Usage: npm run seed -- --load | --evaluate [--limit N] [--only NAME] [--dry-run] | --jobs");
})();
