import assert from "node:assert";
import { EVALUATION_TOOL, DIMENSIONS, normalizeEvaluation, parseEvaluation } from "../lib/rubric.ts";

// The tool schema requires every dimension, so the model can't skip one
const req = (EVALUATION_TOOL.input_schema as any).properties.scores.required as string[];
assert.deepEqual([...req].sort(), DIMENSIONS.map((d) => d.key).sort());

// A rationale full of quotes is fine when it arrives as an object (the tool path)...
const scores = Object.fromEntries(DIMENSIONS.map((d) => [d.key, { score: 4, confidence: "high", rationale: 'Company said "we hit $400M ARR" and "50% of the Fortune 50"', sources: ["https://x"] }]));
const obj = { summary: 's', facts: {}, scores, pmf_evidence: [{ type: "revenue", signal: "ARR", value: "$400M" }, { type: "demand", signal: "logos", value: "50%" }], red_flags: [], conflicts: [] };
const r = normalizeEvaluation(obj);
assert.equal(r.scores.pmf.score, 4);
assert.ok(r.scores.pmf.rationale.includes('"we hit'));

// ...whereas the same content as unescaped text breaks JSON parsing (what happened in the first test batch)
const broken = JSON.stringify(obj).replace('\\"we hit $400M ARR\\"', '"we hit $400M ARR"');
assert.throws(() => parseEvaluation(broken));
console.log("structured output OK");
