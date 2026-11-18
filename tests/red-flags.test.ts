// Red flags = events and conduct only (team rule, Nov 17). Fixtures are the real flags from the first evaluations.
import assert from "node:assert/strict";
import { isRealRedFlag, realRedFlags, parseEvaluation } from "../lib/rubric.ts";

const cloudzero = [
  { type: "leadership_exodus", severity: "medium", detail: "CEO Phil Pergola replaced by Justin Moore, founding partner of lead investor Innovius, in 2026; an investor taking over as CEO suggests a reset or turnaround" },
  { type: "overstated_metrics", severity: "medium", detail: "Sacra's '757% YoY' ARR growth doesn't match the stated ARR history (~$31.5M end-2025, ~$14M late 2024)" },
  { type: "customer_or_partner_concentration", severity: "low", detail: "Heavy reliance on the AWS partnership and channel, while AWS also offers free cost-management tools that compete" },
];
assert.deepEqual(realRedFlags(cloudzero).map((f) => f.type), ["leadership_exodus"], "keeps the CEO change, drops the data mismatch and the dependency");

const sierra = [
  { type: "governance_ethics", severity: "low", detail: "CEO Bret Taylor also chairs OpenAI's board, a potential conflict and split of attention" },
  { type: "customer_or_partner_concentration", severity: "medium", detail: "Salesforce, a key CRM integration surface, bought Fin and is now a direct competitor" },
  { type: "overstated_metrics", severity: "low", detail: "ARR is self-reported; outcome-based ARR definitions and gross margins are not audited or disclosed" },
];
assert.deepEqual(realRedFlags(sierra).map((f) => f.type), ["governance_ethics"]);

assert.equal(isRealRedFlag({ type: "overstated_metrics", detail: "The company restated its 2025 revenue after an audit" }), true, "own claims proven false stay");
assert.equal(isRealRedFlag({ type: "layoffs_or_down_round", detail: "Laid off 20% of staff in March 2026" }), true);
assert.equal(isRealRedFlag({ type: undefined, detail: "Raised $60M while pre-revenue; monetization unclear" }), false, "business risk, already graded");

// The parser applies the rule and keeps at most 3
const g = { score: 3, confidence: "medium", rationale: "x", sources: [] };
const scores = Object.fromEntries(["market","pmf","growth","moat","competition","business_model","gtm","independence","risk_retirement","capital","team","ai_positioning","valuation_headroom","career_velocity"].map((k) => [k, g]));
const parsed = parseEvaluation(JSON.stringify({ summary: "s", facts: {}, scores, pmf_evidence: [], conflicts: [], red_flags: [
  ...cloudzero,
  { type: "legal_or_regulatory", severity: "high", detail: "FTC investigation opened 2026" },
  { type: "layoffs_or_down_round", severity: "medium", detail: "Down round at half the prior valuation" },
  { type: "governance_ethics", severity: "low", detail: "Founder dispute in court" },
] }));
assert.equal(parsed.red_flags.length, 3);
assert.ok(!parsed.red_flags.some((f) => f.type === "customer_or_partner_concentration"));
console.log("RED FLAGS OK");
