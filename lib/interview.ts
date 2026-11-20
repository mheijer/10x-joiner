// "Questions to ask in your interview": 3 pointed questions per company, each tied to an LTV framework. Pure, free.
//   1-2. The company's biggest gaps: dimensions graded lowest, ranked by how much the USER weights them (so a user
//        who cares about team gets the team question first). Joiner Upside gaps (valuation, career) count too.
//   3.   One about the user's target role (or, with none set, about what they'd own).
// No AI call: the question bank below is written once; the company's grades and the profile pick from it.
import type { JobFunction } from "./jobs.ts";

export interface InterviewQuestion {
  q: string;
  why: string; // what in the data prompted it
  concept: string; // the course framework behind it
}

type Bank = Record<string, { q: (name: string) => string; concept: string }>;

/** One question per dimension, aimed at the gap that a low grade signals. */
export const DIMENSION_QUESTIONS: Bank = {
  market: { q: (n) => `Which beachhead does ${n} clearly own today, and which "bowling pin" comes next?`, concept: "Bowling pins; bottom-up TAM" },
  pmf: { q: () => `What share of customers would be "very disappointed" to lose the product, and how has churn moved over the last four quarters?`, concept: "HUNCH; Sean Ellis 40% test; usage leads, churn lags" },
  growth: { q: () => `How much of this year's growth came from new logos versus expansion in existing cohorts? What is net dollar retention?`, concept: "T2D3 / Q2T3; cohort expansion" },
  moat: { q: (n) => `If a frontier model provider shipped this as a feature next year, what would customers still need ${n} for?`, concept: "Helmer's 7 Powers; avoiding the GPT wrapper" },
  competition: { q: () => `Where do you win head-to-head, and which customers do you deliberately not compete for?`, concept: "Blue Ocean Strategy" },
  business_model: { q: () => `What do gross margin and CAC payback look like by cohort and channel, not on average?`, concept: "LTV/CAC done right (Comun); business model tiers" },
  gtm: { q: () => `Who is the ICP you'd turn down deals outside of, and how long is the sales cycle there?`, concept: "Your ICP is your destiny; ACV vs sales model" },
  independence: { q: () => `Which platform, partner or model provider could squeeze your distribution or margins, and what's the plan if they do?`, concept: "Beware gatekeepers (Sweet 16)" },
  risk_retirement: { q: () => `What is the biggest risk you haven't retired yet, and which experiment retires it next?`, concept: "Risk sequencing (C16 Bio); Lean Startup" },
  capital: { q: () => `How many months of runway do you have, and what must the next round prove that this one didn't?`, concept: "Paley: value per dollar raised; premature scaling" },
  team: { q: () => `What earned secret do the founders have, and what's the biggest call they changed their mind on?`, concept: "Earned secrets; founder-market fit" },
  ai_positioning: { q: () => `Is the product a copilot or an autopilot today, and which workflow does it own end to end?`, concept: "Services as software (Sequoia); system of intelligence" },
  valuation_headroom: { q: () => `What has to be true for the next round to be priced at 3x today's valuation?`, concept: "The valuation equation; Paley: big valuations raise the exit bar" },
  career_velocity: { q: () => `What would I own in my first 90 days, and how have people in this seat grown since joining?`, concept: "10x Joiner: own metrics, optimize for learning" },
};

/** The role question, by target function. */
export const ROLE_QUESTIONS: Record<JobFunction, { q: string; concept: string }> = {
  product: { q: "Which metric would I own as a PM, and how do you decide what not to build?", concept: "Jobs to Be Done; 10x Joiner: own metrics" },
  bizops: { q: "Which decision last quarter changed because of an analysis, and who owns the company's core metrics?", concept: "10x Joiner: own metrics" },
  chief_of_staff: { q: "What are you doing yourself today that you'd hand to me in month one?", concept: "The early-stage CEO's job (Bardin)" },
  gtm: { q: "Is the sales motion repeatable yet? Which phase of the Sales Learning Curve are you in?", concept: "Sales Learning Curve" },
  fde: { q: "How do lessons from customer deployments get back into the product, and how fast?", concept: "Forward-deployed engineers (Blitzy)" },
  marketing: { q: "Which channel has proven CAC payback, and which are still experiments?", concept: "LTV/CAC by channel" },
  engineering: { q: "How does the team use AI to build the product itself?", concept: "The 10x org ('Blitzy building Blitzy')" },
  other: { q: "What would I own in my first 90 days, and how would you measure it?", concept: "10x Joiner: own metrics" },
};

type Grade = { score: number; confidence?: string };

export function interviewQuestions(
  company: { name: string; scores?: Record<string, Grade | undefined> | null },
  opts: { weights: Record<string, number>; labels: Record<string, string>; targetFunctions?: JobFunction[] },
): InterviewQuestion[] {
  const out: InterviewQuestion[] = [];
  const scores = company.scores ?? {};
  // Gaps: graded 3 or below, ranked by (how far below 5) x (how much the user cares). Joiner Upside dimensions
  // aren't in the Winning weights, so they get a middling weight.
  const gaps = Object.entries(scores)
    .filter(([k, g]) => g && DIMENSION_QUESTIONS[k] && g.score <= 3)
    .map(([k, g]) => ({ k, g: g!, rank: (5 - g!.score) * (opts.weights[k] ?? 8) }))
    .sort((a, b) => b.rank - a.rank);
  for (const { k, g } of gaps.slice(0, 2)) {
    const low = g.confidence === "low";
    out.push({
      q: DIMENSION_QUESTIONS[k].q(company.name),
      why: `${opts.labels[k] ?? k} is one of ${company.name}'s weakest grades (${g.score}/5)${low ? ", and the public evidence is thin" : ""}`,
      concept: DIMENSION_QUESTIONS[k].concept,
    });
  }
  // Fewer than two gaps: ask where the evidence is thinnest instead
  if (out.length < 2) {
    const thin = Object.entries(scores)
      .filter(([k, g]) => g && DIMENSION_QUESTIONS[k] && g.confidence === "low" && !gaps.slice(0, 2).some((x) => x.k === k))
      .sort((a, b) => (opts.weights[b[0]] ?? 8) - (opts.weights[a[0]] ?? 8));
    for (const [k] of thin.slice(0, 2 - out.length)) {
      out.push({ q: DIMENSION_QUESTIONS[k].q(company.name), why: `We couldn't verify ${opts.labels[k] ?? k} from public sources`, concept: DIMENSION_QUESTIONS[k].concept });
    }
  }
  // Still short (a strong company with solid evidence): pressure-test where it's merely good on what the user weights most
  if (out.length < 2) {
    const mid = Object.entries(scores)
      .filter(([k, g]) => g && DIMENSION_QUESTIONS[k] && k !== "career_velocity" && !out.some((x) => x.concept === DIMENSION_QUESTIONS[k].concept))
      .sort((a, b) => (opts.weights[b[0]] ?? 0) * (5 - b[1]!.score) - (opts.weights[a[0]] ?? 0) * (5 - a[1]!.score));
    for (const [k, g] of mid.slice(0, 2 - out.length))
      out.push({ q: DIMENSION_QUESTIONS[k].q(company.name), why: `Pressure-test ${opts.labels[k] ?? k} (${g!.score}/5), which you weight heavily`, concept: DIMENSION_QUESTIONS[k].concept });
  }
  // Last: the role question (or what you'd own, if no target role is set)
  const fn = opts.targetFunctions?.find((f) => ROLE_QUESTIONS[f]);
  if (fn) out.push({ q: ROLE_QUESTIONS[fn].q, why: "For the role you're targeting", concept: ROLE_QUESTIONS[fn].concept });
  else if (!out.some((x) => x.concept === DIMENSION_QUESTIONS.career_velocity.concept))
    out.push({ q: DIMENSION_QUESTIONS.career_velocity.q(company.name), why: "Set a target role in your profile for a role-specific question", concept: DIMENSION_QUESTIONS.career_velocity.concept });
  return out.slice(0, 3);
}
