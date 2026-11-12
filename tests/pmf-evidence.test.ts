import assert from "node:assert";
import { parseEvaluation, DIMENSIONS, SYSTEM_PROMPT, buildEvaluationPrompt } from "../lib/rubric.ts";
import { hiringMixSignal, signalsForPrompt } from "../lib/signals.ts";
import { boardUrl } from "../lib/jobs.ts";
const out = "x" + JSON.stringify({ summary:"s", facts:{}, scores:Object.fromEntries(DIMENSIONS.map(d=>[d.key,{score:3,confidence:"high",rationale:"",sources:[]}])),
  pmf_evidence:[{type:"demand",signal:"100+ enterprise logos added in 2025",value:"100+",source:"u"},{bad:1}], red_flags:[], conflicts:[] });
const p = parseEvaluation(out); assert.equal(p.pmf_evidence.length, 1);
assert.ok(/Funding is supporting evidence for product-market fit, never the only evidence/.test(SYSTEM_PROMPT));
const h = hiringMixSignal({ gtm: 30, fde: 10, engineering: 40, product: 5 }, boardUrl("ashby","sierra"))!;
console.log(h.value, h.source);
assert.ok(h.value.includes("47% customer-facing"));
const prompt = buildEvaluationPrompt({ name: "Sierra", website: "sierra.ai" }, signalsForPrompt([h]));
assert.ok(prompt.indexOf("Measured signals") < prompt.indexOf("## Research"));
assert.ok(prompt.indexOf("Customer evidence") < prompt.indexOf("latest funding rounds"));
console.log("CHECK4 PASSED");
