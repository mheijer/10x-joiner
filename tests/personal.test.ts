// Personalization: defaults stay the baseline, the shown metric follows the sort/filter, equity estimate sources.
import assert from "node:assert/strict";
import { EMPTY_PROFILE, isPersonalized, activeWeights, personalFor, shownMetric, metricValue, baseSalaryFor, firstEquityEstimate, ASSUMED_BASE_USD } from "../lib/personal.ts";
import { DEFAULT_WEIGHTS } from "../lib/rubric.ts";
import { composite, WEIGHT_PRESETS } from "../lib/scoring.ts";

const g = (score: number, confidence = "high") => ({ score, confidence, rationale: "", sources: [] });
const scores: any = {
  market: g(5), pmf: g(5), growth: g(5), moat: g(3), competition: g(4), business_model: g(4), gtm: g(5),
  independence: g(3), risk_retirement: g(4), capital: g(5), team: g(5), ai_positioning: g(5),
  valuation_headroom: g(3, "medium"), career_velocity: g(5, "medium"),
};
const company: any = { name: "Acme", sector: "AI agents for customer service", stage: "Series D", headcount: 400, hq_city: "San Francisco, CA",
  scores, composite: composite(scores), joiner_upside: 71, latest_post_money_usd: 10e9, total_funding_usd: 600e6, hiring_profile: null, red_flags: [] };

// 1. Defaults are the baseline: an empty profile is not personalized and scores equal the team score.
assert.equal(isPersonalized(EMPTY_PROFILE), false);
assert.deepEqual(activeWeights(EMPTY_PROFILE), DEFAULT_WEIGHTS);
const p0 = personalFor(company, EMPTY_PROFILE);
assert.equal(p0.winning, company.composite);
assert.equal(p0.personal, company.composite, "no profile → For you = Probability of Winning");

// 2. Suggested weights stored but not applied do nothing.
const stored = { ...EMPTY_PROFILE, weights: WEIGHT_PRESETS.safety_first.weights };
assert.equal(personalFor(company, stored).winning, company.composite);
// Applied: the score changes.
const applied = { ...stored, weights_source: "custom" as const };
assert.notEqual(personalFor(company, applied).winning, company.composite);

// 3. Preferences make it personal and blend in fit.
const prof = { ...EMPTY_PROFILE, preferences: { locations: ["New York, NY"], interests: ["customer service"] } };
assert.equal(isPersonalized(prof), true);
const pp = personalFor(company, prof);
assert.ok(pp.personal != null && pp.personal !== company.composite);

// 4. Shown metric follows the sort, then the last score filter.
assert.equal(shownMetric({ sort: "joiner_upside", lastScoreFilter: null, personalized: false }), "joiner_upside");
assert.equal(shownMetric({ sort: "funding", lastScoreFilter: "joiner_upside", personalized: true }), "joiner_upside");
assert.equal(shownMetric({ sort: "name", lastScoreFilter: null, personalized: true }), "personal");
assert.equal(shownMetric({ sort: "name", lastScoreFilter: null, personalized: false }), "composite");
assert.equal(metricValue(company, "joiner_upside", p0), 71);

// 5. Base salary source order, and the estimate needs a valuation.
assert.equal(baseSalaryFor(null, {}).usd, ASSUMED_BASE_USD);
assert.equal(baseSalaryFor(null, {}).isAssumption, true);
assert.equal(baseSalaryFor(null, { min_base_salary_usd: 190000 }).usd, 190000);
const hp: any = { total_open: 3, salary_bands: [{ function: "product", label: "Product", postings_with_pay: 2, min: 180000, max: 240000, median_mid: 210000 }] };
assert.equal(baseSalaryFor(hp, { target_functions: ["product"] as any }).usd, 210000);
assert.equal(baseSalaryFor(hp, { target_functions: ["product"] as any }, 150000).usd, 150000);
const eq = firstEquityEstimate(company, {});
assert.ok(eq && eq.estimate.grant && eq.estimate.equity, "estimate built");
assert.equal(firstEquityEstimate({ ...company, latest_post_money_usd: null }, {}), null);
console.log("PERSONAL OK", { personal: pp.personal, ev: eq!.estimate.equity!.expectedValueUsd });
