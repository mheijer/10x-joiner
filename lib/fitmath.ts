// Personal fit, 0-100, computed with plain math from the user's structured preferences and each company's
// stored data. Free to run across all 556 companies. Every point traces to a stated preference, so the UI can
// show the breakdown ("+30: 2 open Product roles"). Pure functions, no I/O.
//
// The AI is used only twice: once per user to turn their résumé and goals into these preferences
// (lib/fit.ts parseProfile), and once per company the user actually opens, to write the explanation (explainFit).
import { stageBucket } from "./equity.ts";
import type { Preferences } from "./filters.ts";
import type { HiringProfile } from "./hiring.ts";
import { FUNCTION_LABEL } from "./hiring.ts";

export interface FitCompany {
  name: string;
  sector?: string | null;
  description?: string | null;
  stage?: string | null;
  pmf_score?: number | null;
  headcount?: number | null;
  headcount_growth_pct?: number | null;
  hq_city?: string | null;
  work_policy?: string | null;
  customer_type?: string[] | null;
  business_type?: string | null;
  hiring?: HiringProfile | null; // null = no job board found
}

export interface FitItem {
  factor: "roles" | "stage" | "size" | "interests" | "location" | "pay" | "momentum";
  points: number;
  max: number;
  reason: string;
}

export interface FitResult {
  score: number; // 0-100
  items: FitItem[];
}

// Points available per factor (sum = 100). Roles carry the most: a joiner needs a seat.
export const FIT_MAX = { roles: 30, stage: 15, size: 10, interests: 15, location: 15, pay: 10, momentum: 5 } as const;

const lc = (s?: string | null) => (s ?? "").toLowerCase();

export function computeFit(c: FitCompany, p: Preferences): FitResult {
  const items: FitItem[] = [];
  const add = (factor: FitItem["factor"], frac: number, reason: string) =>
    items.push({ factor, points: Math.round(FIT_MAX[factor] * Math.max(0, Math.min(1, frac)) * 10) / 10, max: FIT_MAX[factor], reason });

  // 1. Open roles in the user's target functions. No role isn't a dealbreaker (outreach still works).
  const targets = p.target_functions ?? [];
  if (!targets.length) add("roles", 0.5, "No target function set");
  else if (!c.hiring) add("roles", 0.4, "Job board not found: check the careers page");
  else {
    const n = c.hiring.by_function.filter((b) => targets.includes(b.function)).reduce((a, b) => a + b.count, 0);
    const label = targets.map((t) => FUNCTION_LABEL[t]).join(" / ");
    if (n >= 2) add("roles", 1, `${n} open ${label} roles`);
    else if (n === 1) add("roles", 0.75, `1 open ${label} role`);
    else add("roles", 0.25, `No open ${label} roles${c.hiring.focus ? `; hiring is focused on ${c.hiring.focus.label}` : ""} (outreach still possible)`);
  }

  // 2. Stage (judged by traction, as in the equity model)
  const want = p.stage_buckets ?? [];
  if (!want.length) add("stage", 0.6, "No stage preference");
  else if (!c.stage) add("stage", 0.4, "Stage unknown");
  else {
    const b = stageBucket(c.stage, c.pmf_score);
    const order = ["early", "mid", "late"];
    const dist = Math.min(...want.map((w) => Math.abs(order.indexOf(w) - order.indexOf(b))));
    add("stage", dist === 0 ? 1 : dist === 1 ? 0.45 : 0, dist === 0 ? `${c.stage}: the stage you want` : `${c.stage}: ${dist === 1 ? "one step" : "two steps"} from your range`);
  }

  // 3. Size
  const [lo, hi] = p.headcount ?? [null, null];
  if (lo == null && hi == null) add("size", 0.6, "No size preference");
  else if (c.headcount == null) add("size", 0.4, "Headcount unknown");
  else {
    const h = c.headcount;
    const inRange = (lo == null || h >= lo) && (hi == null || h <= hi);
    const near = (lo == null || h >= lo / 2) && (hi == null || h <= hi * 2);
    add("size", inRange ? 1 : near ? 0.5 : 0, `~${h} people${inRange ? ", in your range" : near ? ", near your range" : ", outside your range"}`);
  }

  // 4. Interests and sectors (keyword match on sector, description, customer and business type)
  const terms = [...(p.interests ?? []), ...(p.sectors ?? [])].map(lc).filter(Boolean);
  if (!terms.length) add("interests", 0.5, "No interests set");
  else {
    const hay = [c.sector, c.description, ...(c.customer_type ?? []), c.business_type].map(lc).join(" ");
    const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hits = terms.filter((t) => new RegExp(`\\b${esc(t)}\\b`, "i").test(hay)); // whole words: "ai" ≠ "retail"
    const ctype = p.customer_types?.length && c.customer_type?.some((t) => p.customer_types!.includes(t as any));
    const frac = Math.min(1, hits.length * 0.6 + (ctype ? 0.4 : 0));
    add("interests", frac, hits.length ? `Matches your interest in ${hits.slice(0, 2).join(", ")}` : ctype ? "Sells to the customers you like" : "Outside your stated interests");
  }

  // 5. Location and work policy
  const metros = (p.locations ?? []).map((l) => lc(l.split(",")[0]));
  if (!metros.length) add("location", 0.6, "No location preference");
  else if (c.work_policy === "remote" && p.work_policy?.includes("remote")) add("location", 1, "Remote, as you want");
  else if (!c.hq_city) add("location", 0.4, "Location unknown");
  else {
    const hit = metros.some((m) => lc(c.hq_city).includes(m));
    add("location", hit ? 1 : 0, hit ? `Based in ${c.hq_city}` : `Based in ${c.hq_city}, outside your locations`);
  }

  // 6. Posted pay for the user's function vs their minimum base
  const band = c.hiring?.salary_bands.find((b) => targets.includes(b.function)) ?? null;
  if (!p.min_base_salary_usd) add("pay", 0.6, band ? `Posted ${band.label} pay: $${k(band.min)}–$${k(band.max)}` : "No pay target set");
  else if (!band) add("pay", 0.5, "No posted pay for your function");
  else add("pay", band.median_mid >= p.min_base_salary_usd ? 1 : band.max >= p.min_base_salary_usd ? 0.6 : 0.15, `Posted ${band.label} pay $${k(band.min)}–$${k(band.max)} vs your $${k(p.min_base_salary_usd)}`);

  // 7. Momentum (headcount growth): career velocity for a joiner
  const g = c.headcount_growth_pct;
  add("momentum", g == null ? 0.5 : g >= 50 ? 1 : g >= 20 ? 0.7 : g >= 0 ? 0.4 : 0, g == null ? "Headcount growth unknown" : `Headcount ${g >= 0 ? "+" : ""}${Math.round(g)}% in a year`);

  return { score: Math.round(items.reduce((a, i) => a + i.points, 0)), items };
}

const k = (x: number) => `${Math.round(x / 1000)}K`;
