// "Who to reach out to": one LinkedIn alumni search the joiner runs themselves. We never scrape LinkedIn.
//
// The exact company comes from the company's own website: its homepage (or careers page) links to its LinkedIn
// page, e.g. linkedin.com/company/tennr. That page's People tab, filtered by a school keyword, lists only people who
// work there now, so the search can't drift to a company with a similar name ("Flex", "Rain", "Jump").
// When we can't find that link, we fall back to a plain LinkedIn people search and say so.

const UA = { "User-Agent": "Mozilla/5.0 (10x-joiner research; HBS class project)" };

/** Slugs that aren't a company's own page. */
const NOT_A_COMPANY = /^(linkedin|company|companies|login|share|sharing|shareArticle|in|feed|jobs)$/i;

/**
 * The company's LinkedIn page slug from the links in its HTML. Pure.
 * "https://www.linkedin.com/company/tennr/?trk=x" → "tennr". With several, the most-linked one wins (sites link
 * their own page in the header and footer; a partner or investor is usually linked once).
 */
export function linkedinSlugFromHtml(html: string): string | null {
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/linkedin\.com\/company\/([A-Za-z0-9._~%-]+)/gi)) {
    const slug = decodeURIComponentSafe(m[1]).replace(/[.\-_]+$/, "");
    if (!slug || NOT_A_COMPANY.test(slug)) continue;
    const key = slug.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [k, v] of counts) if (v > n) (best = k), (n = v);
  return best;
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

async function get(url: string, ms = 8000): Promise<Response | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { headers: UA, signal: ctl.signal, redirect: "follow" });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Find the company's LinkedIn page on its own website (homepage, then careers/about pages). Free. */
export async function findLinkedinSlug(domain?: string | null, careersUrl?: string | null): Promise<string | null> {
  const urls = [
    domain && `https://${domain}`,
    domain && `https://www.${domain}`,
    careersUrl,
    domain && `https://${domain}/about`,
    domain && `https://${domain}/careers`,
    domain && `https://${domain}/company`,
  ].filter(Boolean) as string[];
  for (const u of [...new Set(urls)]) {
    const r = await get(u);
    if (!r?.ok) continue;
    const slug = linkedinSlugFromHtml(await r.text().catch(() => ""));
    if (slug) return slug;
  }
  return null;
}

// ---------------------------------------------------------------- schools and search links (pure)

const SCHOOL_ALIASES: [RegExp, string][] = [
  [/^(hbs|harvard business school|harvard business|harvard mba)$/i, "Harvard Business School"],
  [/^(harvard|harvard university|harvard college)$/i, "Harvard"],
  [/^(gsb|stanford gsb|stanford graduate school of business)$/i, "Stanford Graduate School of Business"],
  [/^(wharton|the wharton school)$/i, "Wharton"],
  [/^(mit|massachusetts institute of technology)$/i, "MIT"],
  [/^(mit sloan|sloan)$/i, "MIT Sloan"],
  [/^(upenn|penn|university of pennsylvania)$/i, "University of Pennsylvania"],
];

/** Tidy a school name: trims, expands common short names ("HBS" → "Harvard Business School"). Pure. */
export function normalizeSchool(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  for (const [rx, name] of SCHOOL_ALIASES) if (rx.test(t)) return name;
  return t;
}

export interface AlumniSearch {
  schools: string[]; // what the one search covers, for the caption ("Harvard (incl. HBS)", "University of Michigan")
  url: string;
  exact: boolean; // true: the company's own People tab (right company guaranteed)
}

/** A school term for LinkedIn's Boolean keyword search: multi-word names in straight quotes. */
const term = (s: string) => (/\s/.test(s) ? `"${s.replace(/"/g, "")}"` : s);

/**
 * ONE search for alumni at the company: all of Harvard (which includes HBS) OR any of the user's own schools
 * (from their profile or résumé). Any Harvard school folds into "Harvard". Pure.
 */
export function alumniSearch(company: { name: string; linkedin_slug?: string | null }, userSchools: string[] = []): AlumniSearch {
  const schools: string[] = ["Harvard"];
  for (const raw of userSchools) {
    const s = normalizeSchool(raw);
    if (!s || /harvard/i.test(s) || schools.some((x) => x.toLowerCase() === s.toLowerCase())) continue;
    schools.push(s);
  }
  const keywords = schools.map(term).join(" OR ");
  const slug = company.linkedin_slug?.trim();
  return {
    schools: schools.map((s) => (s === "Harvard" ? "Harvard (incl. HBS)" : s)),
    url: slug
      ? `https://www.linkedin.com/company/${encodeURIComponent(slug)}/people/?keywords=${encodeURIComponent(keywords)}`
      : `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`(${keywords}) AND ${term(company.name)}`)}`,
    exact: !!slug,
  };
}

/** The company's LinkedIn page, if we know it. */
export const linkedinPageUrl = (slug?: string | null): string | null =>
  slug ? `https://www.linkedin.com/company/${encodeURIComponent(slug)}/` : null;
