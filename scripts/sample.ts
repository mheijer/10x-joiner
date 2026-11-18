// Pick a representative random sample of the Rocketship List (team decision: launch with 100 companies).
//
//   npx tsx scripts/sample.ts            → writes data/sample_100.csv + lib/sample.ts and prints how the sample
//                                           compares to the full list
//
// How it stays representative: proportional stratified sampling on region × founding era (a stage proxy: the list
// has no stage column, and its headcount/funding numbers are stale, so we never use them), then, among 2,000 seeded
// draws, the one whose sector mix is closest to the full list. Companies already evaluated are always kept (they're
// paid for). Seeded, so the same command always gives the same 100.
import { readFileSync, writeFileSync } from "node:fs";

const N = 100;
const SEED = 2026;
const KEEP = ["Sierra", "CloudZero", "Mendaera"]; // already evaluated

type Row = Record<string, string>;

/** Minimal CSV reader (quoted fields, escaped quotes, commas/newlines inside quotes). */
function readCsv(text: string): Row[] {
  const out: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c !== "")) out.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  const [head, ...body] = out;
  return body.map((r) => Object.fromEntries(head.map((h, j) => [h, r[j] ?? ""])));
}

const rows: Row[] = readCsv(readFileSync("data/rocketship_2026_us.csv", "utf8"));

const US = (r: Row) => !/switzerland|canada|united kingdom|israel|germany|france/i.test(r.hq_location);
const pool = rows.filter(US);

export function region(hq: string): string {
  const h = hq.toLowerCase();
  if (/new york|, ny\b|brooklyn|new jersey|, nj\b|hoboken|connecticut/.test(h)) return "New York area";
  if (/boston|cambridge, ma|massachusetts|, ma\b/.test(h)) return "Boston area";
  if (/los angeles|santa monica|irvine|san diego|venice|culver|pasadena|el segundo|long beach/.test(h)) return "Southern California";
  if (/california|, ca\b/.test(h)) return "SF Bay Area";
  if (/seattle|washington, united|kirkland|bellevue|, wa\b/.test(h)) return "Seattle";
  if (/texas|, tx\b/.test(h)) return "Texas";
  return "Other US";
}

export function era(year: string): string {
  const y = Number(year);
  if (!y) return "unknown";
  if (y <= 2016) return "founded ≤2016 (mature)";
  if (y <= 2019) return "2017–2019 (growth)";
  if (y <= 2021) return "2020–2021 (scaling)";
  return "2022+ (early)";
}

export function sector(industry: string): string {
  const i = industry.toLowerCase();
  if (/health|bio|medic|pharma/.test(i)) return "Health & bio";
  if (/fin|insur|pay|bank|crypto/.test(i)) return "Fintech";
  if (/cyber|security/.test(i)) return "Security";
  if (/dev|cloud|infra|data/.test(i)) return "Dev & infra";
  if (/robot|hardware|defense|space|energy|climate|auto|manufact/.test(i)) return "Hard tech";
  if (/consumer|commerce|retail|media|gaming|edu/.test(i)) return "Consumer";
  if (/saas|hr|legal|marketing|sales|enterprise/.test(i)) return "B2B software";
  return /ai/.test(i) ? "AI (horizontal)" : "Other";
}

// Mulberry32: small seeded random number generator
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const share = (list: Row[], f: (r: Row) => string) => {
  const m = new Map<string, number>();
  for (const r of list) m.set(f(r), (m.get(f(r)) ?? 0) + 1);
  return new Map([...m].map(([k, v]) => [k, v / list.length]));
};

const stratum = (r: Row) => `${region(r.hq_location)} | ${era(r.founded_year)}`;
const keep = pool.filter((r) => KEEP.includes(r.name));

function draw(rand: () => number): Row[] {
  // Largest-remainder allocation of N across strata, proportional to the full list
  const groups = new Map<string, Row[]>();
  for (const r of pool) groups.set(stratum(r), [...(groups.get(stratum(r)) ?? []), r]);
  const quotas = [...groups].map(([k, g]) => ({ k, g, exact: (g.length / pool.length) * N }));
  quotas.forEach((q) => ((q as any).n = Math.floor(q.exact)));
  let left = N - quotas.reduce((a, q: any) => a + q.n, 0);
  for (const q of [...quotas].sort((a, b) => (b.exact % 1) - (a.exact % 1))) if (left-- > 0) (q as any).n++;
  const picked: Row[] = [];
  for (const q of quotas as any[]) {
    const kept = q.g.filter((r: Row) => KEEP.includes(r.name));
    const rest = q.g.filter((r: Row) => !KEEP.includes(r.name)).sort(() => rand() - 0.5);
    picked.push(...kept.slice(0, q.n), ...rest.slice(0, Math.max(0, q.n - kept.length)));
  }
  for (const k of keep) if (!picked.includes(k)) picked.push(k); // always keep paid-for evaluations
  return picked.slice(0, Math.max(N, picked.length));
}

const target = share(pool, (r) => sector(r.industry));
const distance = (s: Row[]) => {
  const got = share(s, (r) => sector(r.industry));
  return [...target].reduce((a, [k, v]) => a + Math.abs(v - (got.get(k) ?? 0)), 0);
};

const rand = rng(SEED);
let best: Row[] = [];
let bestD = Infinity;
for (let i = 0; i < 2000; i++) {
  const s = draw(rand);
  const d = distance(s);
  if (d < bestD) [best, bestD] = [s, d];
}
best.sort((a, b) => a.name.localeCompare(b.name));

const header = Object.keys(rows[0]);
const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
// The app's list: a TS constant, so the website and the pipeline read the same 100 names with no file I/O.
writeFileSync(
  "lib/sample.ts",
  `// GENERATED by scripts/sample.ts (seed ${SEED}). Do not edit by hand: re-run the script.\n` +
    `// The ${best.length} Rocketship companies the app shows (plus companies users add): a representative sample.\n` +
    `export const SAMPLE_NAMES: readonly string[] = ${JSON.stringify(best.map((r) => r.name), null, 2)};\n\n` +
    `const SET = new Set(SAMPLE_NAMES.map((n) => n.toLowerCase()));\n` +
    `export const inSample = (name: string) => SET.has(name.toLowerCase());\n`,
);
writeFileSync("data/sample_100.csv", [header.join(","), ...best.map((r) => header.map((h) => esc(r[h] ?? "")).join(","))].join("\n") + "\n");

const report = (label: string, f: (r: Row) => string) => {
  const all = share(pool, f), got = share(best, f);
  console.log(`\n${label.padEnd(26)} full list   sample`);
  for (const [k, v] of [...all].sort((a, b) => b[1] - a[1]))
    console.log(`  ${k.padEnd(24)} ${(v * 100).toFixed(0).padStart(5)}%  ${((got.get(k) ?? 0) * 100).toFixed(0).padStart(5)}%`);
};
console.log(`Sample: ${best.length} of ${pool.length} US companies (seed ${SEED}); kept: ${KEEP.join(", ")}`);
report("Region", (r) => region(r.hq_location));
report("Founding era (stage proxy)", (r) => era(r.founded_year));
report("Sector", (r) => sector(r.industry));
