// "Who to reach out to": a LinkedIn search the joiner runs themselves (we never scrape LinkedIn).
// Plain keywords, company + school ("stripe harvard"): no LinkedIn IDs needed, works for every company.
// LinkedIn keywords are AND-ed, so each school is its own search: Harvard first (it includes HBS), then the
// user's other schools from their profile or résumé.

const SCHOOL_ALIASES: [RegExp, string][] = [
  [/^(hbs|harvard business school|harvard business|harvard mba|harvard|harvard university|harvard college)$/i, "Harvard"],
  [/^(gsb|stanford gsb|stanford graduate school of business)$/i, "Stanford GSB"],
  [/^(the wharton school|wharton school)$/i, "Wharton"],
  [/^(massachusetts institute of technology)$/i, "MIT"],
  [/^(upenn|penn)$/i, "University of Pennsylvania"],
];

/** Tidy a school name; any Harvard school becomes "Harvard". Pure. */
export function normalizeSchool(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  for (const [rx, name] of SCHOOL_ALIASES) if (rx.test(t)) return name;
  return /harvard/i.test(t) ? "Harvard" : t;
}

export interface AlumniSearch {
  school: string;
  url: string;
}

/** LinkedIn search for "<company> <school>". */
export const linkedinSearchUrl = (company: string, school: string): string =>
  `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(`${company} ${school}`)}&origin=GLOBAL_SEARCH_HEADER`;

/** Harvard first, then the user's own schools (deduped). Pure. */
export function alumniSearches(company: string, userSchools: string[] = []): AlumniSearch[] {
  const schools = ["Harvard"];
  for (const raw of userSchools) {
    const s = normalizeSchool(raw);
    if (s && !schools.some((x) => x.toLowerCase() === s.toLowerCase())) schools.push(s);
  }
  return schools.map((school) => ({ school, url: linkedinSearchUrl(company, school) }));
}
