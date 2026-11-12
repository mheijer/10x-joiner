import assert from "node:assert";
import { parseEvaluation, DIMENSIONS, SYSTEM_PROMPT } from "../lib/rubric.ts";
const mk = (ev: any[]) => "x" + JSON.stringify({ summary:"s", facts:{}, scores:Object.fromEntries(DIMENSIONS.map(d=>[d.key,{score:5,confidence:"high",rationale:"r",sources:[]}])), pmf_evidence: ev, red_flags:[], conflicts:[] });
const inv = { type:"investor_signal", signal:"Series C to D in 7 months, 3x step-up", value:"$1.5B → $4.5B" };
const cust = (t:string) => ({ type:t, signal:"x", value:"y" });
// Only funding pace -> capped at 3, low confidence
let p = parseEvaluation(mk([inv])); assert.equal(p.scores.pmf.score, 3); assert.equal(p.scores.pmf.confidence, "low"); assert.ok(p.scores.pmf.rationale.includes("Capped"));
// 1 customer + funding -> still capped
p = parseEvaluation(mk([inv, cust("demand")])); assert.equal(p.scores.pmf.score, 3);
// 2 customer + funding -> funding allowed to support, not capped
p = parseEvaluation(mk([inv, cust("demand"), cust("retention")])); assert.equal(p.scores.pmf.score, 5); assert.equal(p.scores.pmf.confidence, "high");
// Other dims untouched
assert.equal(p.scores.capital.score, 5);
assert.ok(/ONE supporting signal/.test(SYSTEM_PROMPT));
console.log("CHECK5 PASSED");
