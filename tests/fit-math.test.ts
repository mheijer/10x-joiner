import assert from "node:assert";
import { computeFit, FIT_MAX } from "../lib/fitmath.ts";
import { hiringProfile } from "../lib/hiring.ts";
import type { Job } from "../lib/jobs.ts";
assert.equal(Object.values(FIT_MAX).reduce((a,b)=>a+b,0), 100);
const J = (title: string, lo: number|null=null, hi: number|null=null): Job => ({ title, department:null, location:null, url:"u", source:"ashby", salary_min:lo, salary_max:hi, salary_currency: lo?"USD":null, salary_text:null, offers_equity:null });
// Example joiner: wants Product in Boston/NYC, mid-stage, AI/enterprise, $180K+
const me = { target_functions:["product"] as any, stage_buckets:["mid"] as any, headcount:[100, 1000] as [number,number], locations:["Boston, MA","New York, NY"], interests:["ai","enterprise"], min_base_salary_usd:180000 };
const cz = computeFit({ name:"CloudZero", sector:"Cloud cost management", description:"Cloud and AI cost intelligence", stage:"Series C", pmf_score:3.85, headcount:159, headcount_growth_pct:14, hq_city:"Boston, MA", customer_type:["enterprise"],
  hiring: hiringProfile([J("Senior/Staff Product Manager, Agentic Practice",170000,220000),J("Principal Product Manager, Agentic Systems",220000,240000),J("Enterprise Account Executive"),J("Staff Software Engineer")]) }, me);
console.log("CloudZero fit", cz.score); cz.items.forEach(i=>console.log(`  ${i.factor.padEnd(9)} ${String(i.points).padStart(4)}/${i.max}  ${i.reason}`));
const sierra = computeFit({ name:"Sierra", sector:"AI", description:"AI customer service agents for enterprises", stage:"Series E", pmf_score:5, headcount:700, headcount_growth_pct:300, hq_city:"San Francisco, CA", customer_type:["enterprise"],
  hiring: hiringProfile([J("Account Executive"),J("Account Executive, Enterprise"),J("SDR"),J("Solutions Engineer"),J("Software Engineer")]) }, me);
console.log("Sierra fit", sierra.score); sierra.items.forEach(i=>console.log(`  ${i.factor.padEnd(9)} ${String(i.points).padStart(4)}/${i.max}  ${i.reason}`));
const blank = computeFit({ name:"X" }, {});
console.log("No preferences, no data:", blank.score);
assert.ok(cz.score > sierra.score);
console.log("CHECK7 PASSED");
const r = computeFit({ name:"Y", sector:"Retail", description:"We maintain retail stores" }, { interests:["ai"] });
assert.equal(r.items.find(i=>i.factor==="interests")!.points, 0);
console.log("CHECK7b PASSED");
