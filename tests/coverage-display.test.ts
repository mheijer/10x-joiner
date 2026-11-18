import assert from "node:assert";
import { coverage } from "../lib/coverage.ts";
import { quadrant, usd, scoreColor } from "../lib/display.ts";
import { DIMENSIONS } from "../lib/rubric.ts";
const all = (conf: string) => Object.fromEntries(DIMENSIONS.map((d) => [d.key, { confidence: conf }]));
assert.equal(coverage({}).level, "none");
assert.equal(coverage({ scores: all("high"), latest_post_money_usd: 1, arr_estimate_usd: 1, headcount: 1, total_funding_usd: 1 }).level, "high");
// Mendaera-like: confident grades, pre-revenue, valuation undisclosed but funding known → high (no longer
// penalized for revenue that is known to be zero, and only partly for an undisclosed valuation)
const pre = { ...all("medium"), pmf: { confidence: "high", rationale: "The company is pre-revenue; first sales expected 2027." } };
assert.equal(coverage({ scores: pre, headcount: 91, total_funding_usd: 97e6 }).level, "high");
assert.ok(coverage({ scores: pre, headcount: 91, total_funding_usd: 97e6 }).reasons.some((r) => /valuation not disclosed/.test(r)));
// Same company with revenue genuinely unknown and no funding data → medium
assert.equal(coverage({ scores: all("medium"), headcount: 91 }).level, "medium");
// CloudZero-like: 2 low-confidence grades + undisclosed valuation → medium, and the reasons name the grades
const cz = { ...all("medium"), growth: { confidence: "low" }, valuation_headroom: { confidence: "low" } };
const czc = coverage({ scores: cz, headcount: 161, total_funding_usd: 119e6, arr_estimate_usd: 42e6 });
assert.equal(czc.level, "medium");
assert.deepEqual(czc.lowConfidence, ["growth", "valuation_headroom"]);
assert.ok(czc.reasons[0].startsWith("2 of"));
assert.equal(coverage({ scores: all("low") }).level, "low");
assert.equal(quadrant(85.9, 71.3), "Pursue");
assert.equal(quadrant(55.8, 44.7), "Pass");
assert.equal(quadrant(48.8, 65), "Lottery ticket");
assert.equal(quadrant(80, 40), "Safe bet");
assert.equal(usd(15.8e9), "$16B"); assert.equal(usd(1.585e9), "$1.6B"); assert.equal(usd(119e6), "$119M");
assert.equal(scoreColor(null), "#9ca3af");
console.log("coverage/display OK");
