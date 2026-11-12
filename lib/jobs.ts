// Live job listings from public applicant-tracking-system (ATS) job boards. No API keys needed.
//   Greenhouse: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
//   Lever:      https://api.lever.co/v0/postings/{slug}?mode=json
//   Ashby:      https://api.ashbyhq.com/posting-api/job-board/{slug}

export type AtsProvider = "greenhouse" | "lever" | "ashby";

export interface Job {
  title: string;
  department: string | null;
  location: string | null;
  url: string;
  source: AtsProvider;
}

export async function fetchJobs(provider: AtsProvider, slug: string): Promise<Job[] | null> {
  try {
    if (provider === "greenhouse") {
      const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
      if (!r.ok) return null;
      const j = await r.json();
      return (j.jobs ?? []).map((x: any) => ({
        title: x.title,
        department: x.departments?.[0]?.name ?? null,
        location: x.location?.name ?? null,
        url: x.absolute_url,
        source: provider,
      }));
    }
    if (provider === "lever") {
      const r = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      if (!r.ok) return null;
      const j = await r.json();
      if (!Array.isArray(j)) return null;
      return j.map((x: any) => ({
        title: x.text,
        department: x.categories?.team ?? x.categories?.department ?? null,
        location: x.categories?.location ?? null,
        url: x.hostedUrl,
        source: provider,
      }));
    }
    if (provider === "ashby") {
      const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
      if (!r.ok) return null;
      const j = await r.json();
      return (j.jobs ?? []).map((x: any) => ({
        title: x.title,
        department: x.department ?? x.team ?? null,
        location: x.location ?? null,
        url: x.jobUrl,
        source: provider,
      }));
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
