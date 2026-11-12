// Live job listings, including posted salary ranges, from public applicant-tracking-system (ATS) job boards.
// No API keys needed.
//   Greenhouse: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true   (pay parsed from posting text)
//   Lever:      https://api.lever.co/v0/postings/{slug}?mode=json                      (salaryRange field, else text)
//   Ashby:      https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true (structured pay)

export type AtsProvider = "greenhouse" | "lever" | "ashby";

export interface Job {
  title: string;
  department: string | null;
  location: string | null;
  url: string;
  source: AtsProvider;
  // Posted pay (where the company publishes it: required in CA, NY, CO, WA and others)
  salary_min: number | null; // annual, in salary_currency
  salary_max: number | null;
  salary_currency: string | null;
  salary_text: string | null; // as posted, e.g. "$170K – $220K • Offers Equity"
  offers_equity: boolean | null; // null = not stated
}

const NO_PAY = { salary_min: null, salary_max: null, salary_currency: null, salary_text: null, offers_equity: null };

/** Pull an annual USD salary range out of free text, e.g. "$170,000 - $220,000" or "$170K–$220K". */
export function parseSalaryText(text: string | null | undefined): Pick<Job, "salary_min" | "salary_max" | "salary_currency" | "salary_text"> {
  if (!text) return { salary_min: null, salary_max: null, salary_currency: null, salary_text: null };
  const t = text
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;|&#160;/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&")
    .replace(/&mdash;|&#8212;/g, "—").replace(/&ndash;|&#8211;/g, "–");
  const m = t.match(/\$\s?(\d{2,3}(?:,\d{3})+|\d{2,3}(?:\.\d+)?\s?[kK])\s*(?:-|–|—|to)\s*\$?\s?(\d{2,3}(?:,\d{3})+|\d{2,3}(?:\.\d+)?\s?[kK])/);
  if (!m) return { salary_min: null, salary_max: null, salary_currency: null, salary_text: null };
  const val = (x: string) => (/[kK]/.test(x) ? parseFloat(x) * 1000 : Number(x.replace(/,/g, "")));
  const lo = val(m[1]);
  const hi = val(m[2]);
  // Ignore hourly rates and implausible numbers
  if (lo < 30000 || hi > 2000000 || hi < lo) return { salary_min: null, salary_max: null, salary_currency: null, salary_text: null };
  return { salary_min: lo, salary_max: hi, salary_currency: "USD", salary_text: m[0].replace(/\s+/g, " ").trim() };
}

const mentionsEquity = (text: string | null | undefined) =>
  text ? (/\b(equity|stock options?|RSUs?|ownership)\b/i.test(text) ? true : null) : null;

export async function fetchJobs(provider: AtsProvider, slug: string): Promise<Job[] | null> {
  try {
    if (provider === "greenhouse") {
      // content=true includes the posting body, where pay ranges usually appear
      const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
      if (!r.ok) return null;
      const j = await r.json();
      return (j.jobs ?? []).map((x: any) => {
        const body = x.content ? String(x.content) : null;
        const pay = parseSalaryText(body);
        return {
          title: x.title,
          department: x.departments?.[0]?.name ?? null,
          location: x.location?.name ?? null,
          url: x.absolute_url,
          source: provider,
          ...pay,
          offers_equity: mentionsEquity(body),
        };
      });
    }
    if (provider === "lever") {
      const r = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      if (!r.ok) return null;
      const j = await r.json();
      if (!Array.isArray(j)) return null;
      return j.map((x: any) => {
        const sr = x.salaryRange; // { min, max, currency, interval } when the company posts it
        const annual = sr && (!sr.interval || /year|annual/i.test(sr.interval));
        const text = [x.salaryDescriptionPlain, x.descriptionPlain, x.additionalPlain].filter(Boolean).join(" ");
        const pay = annual && sr.min
          ? { salary_min: sr.min, salary_max: sr.max ?? sr.min, salary_currency: sr.currency ?? "USD", salary_text: x.salaryDescriptionPlain ?? null }
          : parseSalaryText(text);
        return {
          title: x.text,
          department: x.categories?.team ?? x.categories?.department ?? null,
          location: x.categories?.location ?? null,
          url: x.hostedUrl,
          source: provider,
          ...pay,
          offers_equity: mentionsEquity(text),
        };
      });
    }
    if (provider === "ashby") {
      // includeCompensation=true returns structured pay: Salary / EquityPercentage / Bonus components
      const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`);
      if (!r.ok) return null;
      const j = await r.json();
      return (j.jobs ?? []).map((x: any) => {
        const comp = x.compensation;
        const parts: any[] = comp?.summaryComponents ?? comp?.compensationTiers?.[0]?.components ?? [];
        const salary = parts.find((c) => c.compensationType === "Salary" && /year/i.test(c.interval ?? ""));
        const equity = parts.some((c) => c.compensationType === "EquityPercentage" || c.compensationType === "EquityCashValue");
        return {
          title: x.title,
          department: x.department ?? x.team ?? null,
          location: x.location ?? null,
          url: x.jobUrl,
          source: provider,
          ...(salary?.minValue
            ? {
                salary_min: salary.minValue,
                salary_max: salary.maxValue ?? salary.minValue,
                salary_currency: salary.currencyCode ?? "USD",
                salary_text: comp?.compensationTierSummary ?? salary.summary ?? null,
              }
            : { ...NO_PAY }),
          offers_equity: comp ? equity : null,
        };
      });
    }
  } catch {
    return null;
  }
  return null;
}

/** Public URL of a company's job board. */
export function boardUrl(provider: AtsProvider, slug: string): string {
  return {
    greenhouse: `https://job-boards.greenhouse.io/${slug}`,
    lever: `https://jobs.lever.co/${slug}`,
    ashby: `https://jobs.ashbyhq.com/${slug}`,
  }[provider];
}

export type JobFunction =
  | "chief_of_staff"
  | "product"
  | "bizops"
  | "fde"
  | "gtm"
  | "marketing"
  | "engineering"
  | "other";

// Order matters: the first match wins (e.g. "Product Marketing Manager" → marketing, not product).
const FUNCTION_RULES: [JobFunction, RegExp][] = [
  ["chief_of_staff", /chief of staff|\bcos\b|founder'?s? associate|ceo office/i],
  ["marketing", /marketing|brand|communications|\bpr\b|content|growth marketing|demand gen/i],
  ["fde", /forward[- ]deployed|\bfde\b|solutions? (engineer|architect)|deployment strategist|implementation/i],
  ["product", /product manager|\bpm\b|product lead|head of product|product owner|\bapm\b|group product/i],
  ["bizops", /strategy|operations|bizops|biz ops|business operations|strategic finance|corporate development|corp ?dev|\bfp&a\b|analytics lead|special projects|partnerships/i],
  ["gtm", /account executive|\bae\b|sales|business development|\bbdr\b|\bsdr\b|customer success|account manager|revenue|go[- ]to[- ]market|\bgtm\b/i],
  ["engineering", /engineer|developer|scientist|research|infrastructure|security|devops|sre\b|ml\b|machine learning|data/i],
];

/** Map a job title to an MBA-relevant function bucket. */
export function classifyRole(title: string): JobFunction {
  for (const [fn, re] of FUNCTION_RULES) if (re.test(title)) return fn;
  return "other";
}

/** Counts of open roles by function, e.g. { product: 3, gtm: 12, ... }. */
export function countByFunction(jobs: { title: string }[]): Partial<Record<JobFunction, number>> {
  const out: Partial<Record<JobFunction, number>> = {};
  for (const j of jobs) {
    const f = classifyRole(j.title);
    out[f] = (out[f] ?? 0) + 1;
  }
  return out;
}

/** Candidate board slugs from a company name / domain, e.g. "Fireworks AI", "fireworks.ai". */
export function slugCandidates(name: string, domain?: string | null): string[] {
  const base = name.toLowerCase().replace(/\(.*?\)/g, "").trim();
  const c = new Set<string>([
    base.replace(/[^a-z0-9]/g, ""),
    base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  ]);
  if (domain) c.add(domain.toLowerCase().replace(/^www\./, "").split(".")[0]);
  return [...c].filter(Boolean);
}

/**
 * Find a company's job board. Uses the evaluation's hint first (provider + slug),
 * then tries every provider × slug candidate. Returns the first board with jobs.
 */
export async function discoverJobs(
  name: string,
  domain?: string | null,
  hint?: { provider: AtsProvider | null; slug: string | null } | null,
): Promise<{ provider: AtsProvider; slug: string; jobs: Job[] } | null> {
  const tries: [AtsProvider, string][] = [];
  if (hint?.provider && hint.slug) tries.push([hint.provider, hint.slug]);
  for (const slug of slugCandidates(name, domain))
    for (const p of ["ashby", "greenhouse", "lever"] as AtsProvider[]) tries.push([p, slug]);

  for (const [p, s] of tries) {
    const jobs = await fetchJobs(p, s);
    if (jobs && jobs.length > 0) return { provider: p, slug: s, jobs };
  }
  return null;
}
