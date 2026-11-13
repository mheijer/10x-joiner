import assert from "node:assert";
import { coverage } from "../lib/coverage.ts";
import { quadrant, usd, scoreColor } from "../lib/display.ts";
import { DIMENSIONS } from "../lib/rubric.ts";
const all = (conf: string) => Object.fromEntries(DIMENSIONS.map((d) => [d.key, { confidence: conf }]));
assert.equal(coverage({}).level, "none");
assert.equal(coverage({ scores: all("high"), latest_post_money_usd: 1, arr_estimate_usd: 1, headcount: 1, total_funding_usd: 1 }).level, "high");
// Mendaera-like: good confidence but no valuation or ARR → medium
assert.equal(coverage({ scores: all("medium"), headcount: 91, total_funding_usd: 97e6 }).level, "medium");
assert.equal(coverage({ scores: all("low") }).level, "low");
assert.equal(quadrant(85.9, 71.3), "Pursue");
assert.equal(quadrant(55.8, 44.7), "Pass");
assert.equal(quadrant(48.8, 65), "Lottery ticket");
assert.equal(quadrant(80, 40), "Blue chip");
assert.equal(usd(15.8e9), "$16B"); assert.equal(usd(1.585e9), "$1.6B"); assert.equal(usd(119e6), "$119M");
assert.equal(scoreColor(null), "#9ca3af");
console.log("coverage/display OK");
