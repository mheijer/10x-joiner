// Measured traction signals from free public APIs, independent of fundraising.
// These are fed to the evaluation as evidence for PMF and growth, alongside what web search finds.
// Funding says what investors believe (its pace can support a PMF score, see lib/rubric.ts);
// these say what customers and users actually do.
//
// Source                    | Signal                                        | Best for
// --------------------------|-----------------------------------------------|---------------------------
// Company job board (ATS)   | Open roles by function; customer-facing share | Everyone (demand outstripping delivery)
// Hacker News (Algolia API) | Stories & points mentioning the company,      | Tech / dev / AI products
//                           |   last 12 months vs the 12 before (momentum)  |
// Apple App Store (iTunes)  | Rating and number of ratings                  | Consumer apps
// GitHub API                | Stars, forks, recent activity of the org      | Dev tools / open source
// npm / PyPI download APIs  | Monthly package downloads                     | Dev tools with SDKs
//
// All free, no keys required (GitHub allows 60 unauthenticated requests/hour; set GITHUB_TOKEN to raise it).
import type { JobFunction } from "./jobs.ts";

export interface Signal {
  type: "demand" | "retention" | "usage" | "organic_pull" | "hiring";
  metric: string; // human-readable, e.g. "App Store ratings"
  value: string; // e.g. "4.8★ from 52,000 ratings"
  as_of: string; // YYYY-MM-DD
  source: string; // URL
}

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) => n.toLocaleString("en-US");

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "next-10x-joiner (HBS LTV class project)", ...headers } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/**
 * Hacker News stories: last 12 months vs the prior 12 months (a word-of-mouth momentum signal).
 * With a domain, counts only stories linking to the company's site, which avoids name collisions
 * ("Sierra", "Clay"). Without one, falls back to an exact-name search.
 */
export async function hackerNewsSignal(name: string, domain?: string | null): Promise<Signal | null> {
  const now = Math.floor(Date.now() / 1000);
  const yr = 365 * 24 * 3600;
  const q = encodeURIComponent(domain ? domain : `"${name}"`);
  const restrict = domain ? "&restrictSearchableAttributes=url" : "";
  const base = `https://hn.algolia.com/api/v1/search?query=${q}${restrict}&tags=story&hitsPerPage=0&numericFilters=`;
  const [recent, prior] = await Promise.all([
    getJson(`${base}created_at_i>${now - yr}`),
    getJson(`${base}created_at_i>${now - 2 * yr},created_at_i<${now - yr}`),
  ]);
  if (!recent || recent.nbHits == null) return null;
  const a = recent.nbHits as number;
  const b = (prior?.nbHits as number) ?? 0;
  const trend = b > 0 ? ` (${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}% vs prior year)` : "";
  return {
    type: "organic_pull",
    metric: domain ? `Hacker News stories linking to ${domain}, last 12 months` : "Hacker News stories mentioning the company, last 12 months",
    value: `${fmt(a)}${trend}`,
    as_of: today(),
    source: `https://hn.algolia.com/?q=${q}`,
  };
}

/** App Store rating volume for consumer apps (rating count is a rough proxy for usage). */
export async function appStoreSignal(name: string): Promise<Signal | null> {
  const j = await getJson(`https://itunes.apple.com/search?entity=software&country=us&limit=5&term=${encodeURIComponent(name)}`);
  const app = (j?.results ?? []).find(
    (a: any) => a.sellerName?.toLowerCase().includes(name.toLowerCase()) || a.trackName?.toLowerCase().startsWith(name.toLowerCase()),
  );
  if (!app || !app.userRatingCount) return null;
  return {
    type: "usage",
    metric: `App Store ratings (${app.trackName})`,
    value: `${app.averageUserRating?.toFixed(1)}★ from ${fmt(app.userRatingCount)} ratings`,
    as_of: today(),
    source: app.trackViewUrl,
  };
}

/** GitHub org stars and recent activity (dev tools / open source). */
export async function githubSignal(orgGuess: string): Promise<Signal | null> {
  const headers: Record<string, string> = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const repos = await getJson(`https://api.github.com/orgs/${orgGuess}/repos?per_page=100&sort=pushed`, headers);
  if (!Array.isArray(repos) || repos.length === 0) return null;
  const stars = repos.reduce((a: number, r: any) => a + (r.stargazers_count ?? 0), 0);
  if (stars < 100) return null; // ignore orgs with no real open-source footprint
  const top = [...repos].sort((x: any, y: any) => y.stargazers_count - x.stargazers_count)[0];
  return {
    type: "usage",
    metric: "GitHub stars across the company's public repos",
    value: `${fmt(stars)} (top repo: ${top.name}, ${fmt(top.stargazers_count)}★)`,
    as_of: today(),
    source: `https://github.com/${orgGuess}`,
  };
}

/** Monthly npm downloads for a package name (dev tools with JS SDKs). */
export async function npmSignal(pkg: string): Promise<Signal | null> {
  const j = await getJson(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(pkg)}`);
  if (!j?.downloads || j.downloads < 1000) return null;
  return {
    type: "usage",
    metric: `npm downloads of "${pkg}", last month`,
    value: fmt(j.downloads),
    as_of: today(),
    source: `https://www.npmjs.com/package/${pkg}`,
  };
}

/** Monthly PyPI downloads (dev tools with Python SDKs). */
export async function pypiSignal(pkg: string): Promise<Signal | null> {
  const j = await getJson(`https://pypistats.org/api/packages/${encodeURIComponent(pkg)}/recent`);
  const n = j?.data?.last_month;
  if (!n || n < 1000) return null;
  return {
    type: "usage",
    metric: `PyPI downloads of "${pkg}", last month`,
    value: fmt(n),
    as_of: today(),
    source: `https://pypi.org/project/${pkg}`,
  };
}

/**
 * Hiring mix from the live job board. A high share of customer-facing roles (customer success,
 * implementation, FDE, sales) suggests demand is outstripping delivery: Andreessen's "customers
 * buying as fast as you can make it".
 */
export function hiringMixSignal(byFunction: Partial<Record<JobFunction, number>>, boardUrl: string): Signal | null {
  const total = Object.values(byFunction).reduce((a, b) => a + (b ?? 0), 0);
  if (total === 0) return null;
  const customerFacing = (byFunction.gtm ?? 0) + (byFunction.fde ?? 0);
  const parts = Object.entries(byFunction)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
  return {
    type: "hiring",
    metric: "Open roles on the company's job board",
    value: `${total} open (${parts}); ${Math.round((customerFacing / total) * 100)}% customer-facing`,
    as_of: today(),
    source: boardUrl,
  };
}

/** Collect every signal that applies. Each fetcher fails quietly; missing signals simply aren't reported. */
export async function collectSignals(opts: {
  name: string;
  domain?: string | null;
  isConsumer?: boolean;
  isDevTool?: boolean;
  jobsByFunction?: Partial<Record<JobFunction, number>>;
  jobBoardUrl?: string;
}): Promise<Signal[]> {
  const slug = (opts.domain ?? opts.name).toLowerCase().replace(/^www\./, "").split(".")[0].replace(/[^a-z0-9-]/g, "");
  const domain = opts.domain?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? null;
  const tasks: Promise<Signal | null>[] = [hackerNewsSignal(opts.name, domain)];
  if (opts.isConsumer !== false) tasks.push(appStoreSignal(opts.name));
  if (opts.isDevTool !== false) tasks.push(githubSignal(slug), npmSignal(slug), pypiSignal(slug));
  const found = (await Promise.all(tasks)).filter((s): s is Signal => !!s);
  if (opts.jobsByFunction && opts.jobBoardUrl) {
    const h = hiringMixSignal(opts.jobsByFunction, opts.jobBoardUrl);
    if (h) found.push(h);
  }
  return found;
}

/** Render signals for the evaluation prompt. */
export function signalsForPrompt(signals: Signal[]): string {
  if (!signals.length) return "";
  return (
    "\n## Measured signals (pulled from public APIs; treat as evidence, cite the source URL)\n" +
    signals.map((s) => `- [${s.type}] ${s.metric}: ${s.value} (as of ${s.as_of}; ${s.source})`).join("\n") +
    "\n"
  );
}
