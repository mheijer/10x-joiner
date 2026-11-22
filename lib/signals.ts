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
  type: "demand" | "retention" | "usage" | "organic_pull" | "hiring" | "funding" | "regulatory";
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

/**
 * App Store rating volume for consumer apps (rating count is a rough proxy for usage).
 * Only counts an app whose seller website matches the company's domain: name matching alone picked up the
 * off-price retailer "Sierra" for Sierra AI in the first test batch.
 */
export async function appStoreSignal(name: string, domain?: string | null): Promise<Signal | null> {
  if (!domain) return null;
  const j = await getJson(`https://itunes.apple.com/search?entity=software&country=us&limit=10&term=${encodeURIComponent(name)}`);
  const root = domain.toLowerCase().replace(/^www\./, "");
  const app = (j?.results ?? []).find((a: any) => {
    const seller = String(a.sellerUrl ?? "").toLowerCase();
    return seller.includes(root);
  });
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
export async function githubSignal(orgGuess: string, domain?: string | null): Promise<Signal | null> {
  const headers: Record<string, string> = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  // Only count an org that links back to the company's website (an org named "ramp" may be someone else's).
  const org = await getJson(`https://api.github.com/orgs/${orgGuess}`, headers);
  if (!org || !linksTo(domain, [org.blog])) return null;
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

/** The registrable domain: "home.nuancelabs.ai" → "nuancelabs.ai", "app.acme.co.uk" → "acme.co.uk". Pure. */
export function rootDomain(domain?: string | null): string | null {
  if (!domain) return null;
  const host = domain.toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/^www\./, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".") || null;
  const twoPartTld = /^(co|com|org|net|ac|gov|edu)$/.test(parts[parts.length - 2]) && parts[parts.length - 1].length === 2;
  return parts.slice(twoPartTld ? -3 : -2).join(".");
}

/** The name to guess package and org names from: the domain's main label ("nuancelabs"), else the company name. Pure. */
export function slugFor(name: string, domain?: string | null): string {
  const root = rootDomain(domain);
  return (root ? root.split(".")[0] : name.toLowerCase()).replace(/[^a-z0-9-]/g, "");
}

/** True when any of these URLs points at the company's own domain. With no domain to check, nothing counts. Pure. */
export function linksTo(domain: string | null | undefined, urls: unknown[]): boolean {
  const root = rootDomain(domain);
  if (!root) return false;
  return urls.some((u) => {
    if (typeof u !== "string" || !u) return false;
    const r = rootDomain(u);
    return r === root;
  });
}

/** Monthly npm downloads for a package name (dev tools with JS SDKs). Only counted if the package links back to the company. */
export async function npmSignal(pkg: string, domain?: string | null): Promise<Signal | null> {
  const meta = await getJson(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`);
  const repo = typeof meta?.repository === "string" ? meta.repository : meta?.repository?.url;
  if (!meta || !linksTo(domain, [meta.homepage, repo, meta.bugs?.url, meta.author?.url])) return null;
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
export async function pypiSignal(pkg: string, domain?: string | null): Promise<Signal | null> {
  const meta = await getJson(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`);
  const info = meta?.info ?? {};
  if (!linksTo(domain, [info.home_page, info.project_url, ...Object.values(info.project_urls ?? {})])) return null;
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
// ---------------------------------------------------------------- official records (free, no key)
// SEC Form D: US startups file one when they sell stock in a round (amount offered and sold, first-sale date).
// openFDA: device clearances and approvals (510(k), De Novo, PMA): regulatory risk retired for medtech.
// ClinicalTrials.gov: registered trials and their phase: progress for biotech.

const fetchT = async (url: string, init?: RequestInit, ms = 10000) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
};
const SEC_UA = () =>
  `10x-joiner research (HBS class project; github.com/mheijer/10x-joiner)${process.env.SEC_CONTACT_EMAIL ? " " + process.env.SEC_CONTACT_EMAIL : ""}`;
const norm = (x: string) => x.toLowerCase().replace(/\(cik.*$/i, "").replace(/[^a-z0-9]+/g, " ").replace(/\b(inc|llc|corp|corporation|co|ltd|technologies|labs?)\b/g, "").trim();
const usdShort = (x: number) => (x >= 1e9 ? `$${(x / 1e9).toFixed(1)}B` : x >= 1e6 ? `$${Math.round(x / 1e6)}M` : `$${Math.round(x / 1e3)}K`);
const isHealth = (sector?: string | null) => !!sector && /health|bio|med|pharma|clinic|device|surg|diagnos|therap|care/i.test(sector);

/** Matching Form D filings from an EDGAR full-text search response, newest first. Pure. */
export function parseFormDSearch(json: any, company: string): { cik: string; adsh: string; filed: string; entity: string }[] {
  const want = norm(company);
  const out: { cik: string; adsh: string; filed: string; entity: string }[] = [];
  for (const h of json?.hits?.hits ?? []) {
    const src = h._source ?? {};
    const entity = String(src.display_names?.[0] ?? "");
    if (!want || norm(entity) !== want) continue; // exact entity match only: never another company's filing
    const adsh = String(src.adsh ?? String(h._id ?? "").split(":")[0]);
    const cik = String(src.ciks?.[0] ?? "").replace(/^0+/, "");
    if (adsh && cik) out.push({ cik, adsh, filed: String(src.file_date ?? ""), entity: entity.replace(/\s*\(CIK.*$/i, "").trim() });
  }
  return out.sort((a, b) => b.filed.localeCompare(a.filed));
}

/** Amounts from a Form D primary_doc.xml. Pure. */
export function parseFormDXml(xml: string): { offered: number | null; sold: number | null; firstSale: string | null } {
  const num = (tag: string) => {
    const m = xml.match(new RegExp(`<${tag}>\\s*([0-9.]+)\\s*</${tag}>`, "i"));
    return m ? Number(m[1]) : null;
  };
  const d = xml.match(/<dateOfFirstSale>\s*<value>\s*([0-9-]+)\s*<\/value>/i);
  return { offered: num("totalOfferingAmount"), sold: num("totalAmountSold"), firstSale: d ? d[1] : null };
}

export async function secFormDSignal(name: string): Promise<Signal | null> {
  const q = encodeURIComponent(`"${name}"`);
  const r = await fetchT(`https://efts.sec.gov/LATEST/search-index?q=${q}&forms=D`, { headers: { "User-Agent": SEC_UA() } });
  if (!r?.ok) return null;
  const filings = parseFormDSearch(await r.json().catch(() => null), name).slice(0, 6);
  if (!filings.length) return null;
  const rows: string[] = [];
  const seenSale = new Set<string>();
  for (const f of filings) {
    const x = await fetchT(`https://www.sec.gov/Archives/edgar/data/${f.cik}/${f.adsh.replace(/-/g, "")}/primary_doc.xml`, { headers: { "User-Agent": SEC_UA() } });
    if (!x?.ok) continue;
    const d = parseFormDXml(await x.text());
    const key = d.firstSale ?? f.filed;
    if (seenSale.has(key) || (!d.sold && !d.offered)) continue; // amendments repeat the same offering
    seenSale.add(key);
    rows.push(`${key.slice(0, 7)}: ${d.sold ? usdShort(d.sold) + " sold" : "amount undisclosed"}${d.offered ? ` of ${usdShort(d.offered)} offered` : ""}`);
  }
  if (!rows.length) return null;
  return {
    type: "funding",
    metric: `SEC Form D filings (${filings[0].entity})`,
    value: rows.slice(0, 4).join("; ") + ". Official filings: amounts may lag or bundle tranches, and some rounds are filed late or not at all.",
    as_of: today(),
    source: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${filings[0].cik}&type=D`,
  };
}

/** FDA device decisions for an applicant, from openFDA 510(k) and PMA responses. Pure. */
export function parseFda(k510: any, pma: any, company: string): { id: string; device: string; date: string; kind: string }[] {
  const want = norm(company);
  const ymd = (d: string) => (d && d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d);
  const rows = [
    ...(k510?.results ?? []).map((x: any) => ({
      applicant: x.applicant, id: x.k_number, device: x.device_name, date: ymd(String(x.decision_date ?? "")),
      kind: String(x.k_number ?? "").startsWith("DEN") ? "De Novo" : "510(k)",
    })),
    ...(pma?.results ?? []).map((x: any) => ({ applicant: x.applicant, id: x.pma_number, device: x.trade_name ?? x.generic_name, date: ymd(String(x.decision_date ?? "")), kind: "PMA" })),
  ];
  return rows
    .filter((x) => x.id && norm(String(x.applicant ?? "")).startsWith(want))
    .map(({ applicant, ...rest }) => rest)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function fdaSignal(name: string): Promise<Signal | null> {
  const q = encodeURIComponent(`applicant:"${name}"`);
  const [a, b] = await Promise.all([
    fetchT(`https://api.fda.gov/device/510k.json?search=${q}&limit=20`),
    fetchT(`https://api.fda.gov/device/pma.json?search=${q}&limit=20`),
  ]);
  const rows = parseFda(a?.ok ? await a.json().catch(() => null) : null, b?.ok ? await b.json().catch(() => null) : null, name);
  if (!rows.length) return null;
  return {
    type: "regulatory",
    metric: "FDA device clearances/approvals",
    value: `${rows.length}: ` + rows.slice(0, 4).map((r) => `${r.kind} ${r.id} ${r.device} (${r.date})`).join("; "),
    as_of: today(),
    source: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?applicant=${encodeURIComponent(name)}`,
  };
}

/** Trials sponsored by the company, from a ClinicalTrials.gov v2 response. Pure. */
export function parseTrials(json: any): { total: number; active: number; phases: string[]; latest: string | null } {
  const studies: any[] = json?.studies ?? [];
  const status = (s: any) => String(s?.protocolSection?.statusModule?.overallStatus ?? "");
  const phases = [...new Set(studies.flatMap((s) => s?.protocolSection?.designModule?.phases ?? []))].map(String).sort();
  const dates = studies.map((s) => String(s?.protocolSection?.statusModule?.startDateStruct?.date ?? "")).filter(Boolean).sort();
  return {
    total: Number(json?.totalCount ?? studies.length),
    active: studies.filter((s) => /RECRUITING|ACTIVE|ENROLLING|NOT_YET/i.test(status(s))).length,
    phases,
    latest: dates.at(-1) ?? null,
  };
}

export async function clinicalTrialsSignal(name: string): Promise<Signal | null> {
  const r = await fetchT(
    `https://clinicaltrials.gov/api/v2/studies?query.spons=${encodeURIComponent(`"${name}"`)}&pageSize=50&countTotal=true`,
  );
  if (!r?.ok) return null;
  const t = parseTrials(await r.json().catch(() => null));
  if (!t.total) return null;
  return {
    type: "regulatory",
    metric: "Clinical trials sponsored (ClinicalTrials.gov)",
    value: `${t.total} registered, ${t.active} active${t.phases.length ? `; phases: ${t.phases.join(", ")}` : ""}${t.latest ? `; latest start ${t.latest}` : ""}`,
    as_of: today(),
    source: `https://clinicaltrials.gov/search?spons=${encodeURIComponent(name)}`,
  };
}

export async function collectSignals(opts: {
  name: string;
  domain?: string | null;
  sector?: string | null; // health/bio companies also get FDA + clinical-trial checks
  isConsumer?: boolean;
  isDevTool?: boolean;
  jobsByFunction?: Partial<Record<JobFunction, number>>;
  jobBoardUrl?: string;
}): Promise<Signal[]> {
  const slug = slugFor(opts.name, opts.domain);
  const domain = opts.domain?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? null;
  const tasks: Promise<Signal | null>[] = [hackerNewsSignal(opts.name, domain)];
  if (opts.isConsumer !== false) tasks.push(appStoreSignal(opts.name, domain));
  if (opts.isDevTool !== false) tasks.push(githubSignal(slug, domain), npmSignal(slug, domain), pypiSignal(slug, domain));
  tasks.push(secFormDSignal(opts.name).catch(() => null));
  if (isHealth(opts.sector)) tasks.push(fdaSignal(opts.name).catch(() => null), clinicalTrialsSignal(opts.name).catch(() => null));
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
