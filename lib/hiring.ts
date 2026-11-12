// What a company is hiring for, and what it pays: a growth datapoint for joiners. Pure functions.
// Hiring mostly outside your function isn't a negative; it shows where the company is investing to grow.
import { classifyRole } from "./jobs.ts";
import type { Job, JobFunction } from "./jobs.ts";

export const FUNCTION_LABEL: Record<JobFunction, string> = {
  chief_of_staff: "Chief of Staff",
  product: "Product",
  bizops: "Strategy & Ops",
  fde: "Forward-deployed / Solutions",
  gtm: "Sales & Customer Success",
  marketing: "Marketing",
  engineering: "Engineering & Research",
  other: "Other",
};

// What a hiring tilt usually says about where the company is (Sales Learning Curve, Module 2; org building, Module 4).
const FOCUS_READ: Partial<Record<JobFunction, string>> = {
  gtm: "Scaling go-to-market: building the sales machine (Sales Learning Curve: Transition/Execution)",
  fde: "Deploying into big customers: forward-deployed engineers drive land-and-expand (Blitzy)",
  engineering: "Product- and research-led: still building core product or technology",
  product: "Expanding the product surface: new products or bowling pins",
  marketing: "Investing in demand generation and brand",
  bizops: "Professionalizing operations as it scales",
};

export interface SalaryBand {
  function: JobFunction;
  label: string;
  postings_with_pay: number;
  min: number; // lowest posted minimum
  max: number; // highest posted maximum
  median_mid: number; // median of each posting's midpoint
}

export interface HiringProfile {
  total_open: number;
  by_function: { function: JobFunction; label: string; count: number; share: number }[];
  focus: { function: JobFunction; label: string; share: number; read: string } | null;
  pay_transparency: { postings_with_pay: number; share: number };
  salary_bands: SalaryBand[];
  offers_equity_share: number | null; // of postings that state it either way
  your_roles: (Job & { function: JobFunction })[]; // open roles in the user's target functions
  your_function_note: string | null;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function hiringProfile(jobs: Job[], targetFunctions: JobFunction[] = []): HiringProfile {
  const tagged = jobs.map((j) => ({ ...j, function: classifyRole(j.title) }));
  const total = tagged.length;
  const counts = new Map<JobFunction, number>();
  for (const j of tagged) counts.set(j.function, (counts.get(j.function) ?? 0) + 1);
  const by_function = [...counts.entries()]
    .map(([f, count]) => ({ function: f, label: FUNCTION_LABEL[f], count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count);

  // Focus = largest function, if it is a meaningful share of hiring (ignore "other")
  const top = by_function.find((b) => b.function !== "other");
  const focus =
    top && top.share >= 0.3 && FOCUS_READ[top.function]
      ? { function: top.function, label: top.label, share: top.share, read: FOCUS_READ[top.function]! }
      : null;

  const paid = tagged.filter((j) => j.salary_min != null && j.salary_currency === "USD");
  const bands: SalaryBand[] = [];
  for (const f of new Set(paid.map((j) => j.function))) {
    const ps = paid.filter((j) => j.function === f);
    bands.push({
      function: f,
      label: FUNCTION_LABEL[f],
      postings_with_pay: ps.length,
      min: Math.min(...ps.map((j) => j.salary_min!)),
      max: Math.max(...ps.map((j) => j.salary_max ?? j.salary_min!)),
      median_mid: Math.round(median(ps.map((j) => ((j.salary_min ?? 0) + (j.salary_max ?? j.salary_min ?? 0)) / 2))),
    });
  }
  bands.sort((a, b) => b.postings_with_pay - a.postings_with_pay);

  const stated = tagged.filter((j) => j.offers_equity != null);
  const your_roles = tagged.filter((j) => targetFunctions.includes(j.function));
  let your_function_note: string | null = null;
  if (targetFunctions.length && total) {
    const mine = your_roles.length;
    const label = targetFunctions.map((f) => FUNCTION_LABEL[f]).join(" / ");
    your_function_note =
      mine > 0
        ? `${mine} open ${label} role${mine > 1 ? "s" : ""} (${Math.round((mine / total) * 100)}% of hiring).`
        : `No open ${label} roles right now. Not a negative: ${focus ? `the company is investing in ${focus.label.toLowerCase()}` : "hiring is elsewhere"}. Worth a direct outreach if you're excited about it.`;
  }

  return {
    total_open: total,
    by_function,
    focus,
    pay_transparency: { postings_with_pay: paid.length, share: total ? paid.length / total : 0 },
    salary_bands: bands,
    offers_equity_share: stated.length ? stated.filter((j) => j.offers_equity).length / stated.length : null,
    your_roles,
    your_function_note,
  };
}
