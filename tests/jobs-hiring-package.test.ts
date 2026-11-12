import assert from "node:assert";
import { parseSalaryText, classifyRole } from "../lib/jobs.ts";
import { hiringProfile } from "../lib/hiring.ts";
import { estimatePackage } from "../lib/equity.ts";
import type { Job } from "../lib/jobs.ts";

// Salary parsing across formats
const cases: [string, number|null, number|null][] = [
  ["The base salary range is $170,000 - $220,000 USD.", 170000, 220000],
  ["Pay: $150K–$190K + equity", 150000, 190000],
  ["&lt;p&gt;Compensation: $185,000&mdash;$240,000&lt;/p&gt;", 185000, 240000],
  ["$65 - $80 per hour", null, null],
  ["We offer competitive pay", null, null],
];
for (const [t, lo, hi] of cases) { const p = parseSalaryText(t); assert.equal(p.salary_min, lo, t); assert.equal(p.salary_max, hi, t); }

// CloudZero-like board (real posted ranges for PM roles)
const J = (title: string, lo: number|null=null, hi: number|null=null, eq: boolean|null=null): Job => ({ title, department:null, location:"Boston, MA", url:"u", source:"ashby", salary_min:lo, salary_max:hi, salary_currency: lo?"USD":null, salary_text: lo?`$${lo/1000}K – $${hi!/1000}K`:null, offers_equity:eq });
const jobs = [J("Enterprise Account Executive - West",null,null,true), J("Senior/Staff Product Manager, Agentic Practice",170000,220000,true), J("Principal Product Manager, Agentic Systems",220000,240000,true),
  J("Staff / Principal Software Engineer"), J("Senior Platform Engineer"), J("Director, Brand & Corporate Communications"), J("AI ROI Advisory Services Director")];
const hp = hiringProfile(jobs, ["product"]);
console.log(JSON.stringify({ total: hp.total_open, by: hp.by_function.map(b=>`${b.label} ${b.count}`), focus: hp.focus?.read, bands: hp.salary_bands, note: hp.your_function_note, equity: hp.offers_equity_share }, null, 1));
assert.equal(hp.salary_bands[0].function, "product"); assert.equal(hp.salary_bands[0].median_mid, 212500);

// Sales-heavy board, user wants product: note is a datapoint, not a penalty
const sales = hiringProfile([J("Account Executive"),J("Account Executive, Enterprise"),J("SDR"),J("Customer Success Manager"),J("Software Engineer")], ["product"]);
console.log("sales-heavy:", sales.focus?.read, "|", sales.your_function_note);
assert.equal(sales.focus?.function, "gtm");

// Package estimate: CloudZero, Senior PM midpoint base, est. $500M valuation, Series C
const pkg = estimatePackage({ companyName:"CloudZero", stage:"Series C", pmfScore:3.85, postMoneyUsd:500e6, postMoneyIsEstimate:true, totalRaisedUsd:119e6, baseSalaryUsd:195000, baseSalarySource:"posted range for Senior/Staff PM, $170K–$220K (Ashby)" });
console.log("\nCloudZero package:", JSON.stringify({ grant: pkg.grant, exercise: pkg.exercise_cost_usd, EV: pkg.equity?.expectedValueUsd, annualized: pkg.annualized_mid_usd, instrument: pkg.instrument }));
pkg.assumptions.forEach(a=>console.log("  •", a));
assert.ok(pkg.grant && pkg.grant.pct_mid > 0);
// With a real offer, the offer wins
const off = estimatePackage({ companyName:"X", stage:"Series E", postMoneyUsd:15.8e9, totalRaisedUsd:1.585e9, baseSalaryUsd:250000, offer:{ grantPct:0.002 } });
assert.equal(off.grant, null); assert.equal(off.instrument, "RSUs (likely)"); assert.equal(off.exercise_cost_usd, 0);
console.log("CHECK6 PASSED");
