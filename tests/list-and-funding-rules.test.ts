import assert from "node:assert";
import { factsToCompanyUpdate, bestTotalFunding } from "../lib/facts.ts";
import { buildEvaluationPrompt, SYSTEM_PROMPT } from "../lib/rubric.ts";
// CloudZero-style conflict: model says $85M, rounds found sum to $118.6M -> take larger
assert.equal(bestTotalFunding({ total_funding_usd: 85e6, funding_rounds: [{round:"C",amount_usd:56e6},{round:"B",amount_usd:32e6},{round:"B-III",amount_usd:6e6},{round:"A",amount_usd:24.6e6}] }), 118.6e6);
assert.equal(bestTotalFunding({ total_funding_usd: 1.585e9, funding_rounds: [{round:"E",amount_usd:950e6}] }), 1.585e9);
assert.equal(bestTotalFunding({}), null);
// List numbers never used
const u = factsToCompanyUpdate({}, { headcount: 4, total_funding_usd: 97e6, hq_city: "San Mateo, CA" });
assert.equal(u.headcount, null); assert.equal(u.total_funding_usd, null); assert.equal(u.hq_city, "San Mateo, CA");
const p = buildEvaluationPrompt({ name: "Mendaera", website: "mendaera.com", hq_location: "San Mateo, CA" });
assert.ok(!/Employees/.test(p)); assert.ok(/LARGEST credible figure/.test(SYSTEM_PROMPT));
console.log("CHECK3 PASSED");
