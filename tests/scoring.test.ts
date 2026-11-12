import assert from "node:assert";
import { DIMENSIONS, WINNING_DIMENSIONS, JOINER_DIMENSIONS, DEFAULT_WEIGHTS, buildEvaluationPrompt, parseEvaluation } from "../lib/rubric.ts";
import { composite, joinerUpside, personalScore, normalizeWeights, WEIGHT_PRESETS, redFlagPenalty } from "../lib/scoring.ts";
import { estimateEquity, defaultFutureRounds, defaultScenarios, stageBucket } from "../lib/equity.ts";
import { classifyRole, countByFunction } from "../lib/jobs.ts";
import { applyPreferences } from "../lib/filters.ts";
import { factsToCompanyUpdate, revenuePerEmployee } from "../lib/facts.ts";
import { spearman } from "../lib/stats.ts";

assert.equal(WINNING_DIMENSIONS.length, 12); assert.equal(JOINER_DIMENSIONS.length, 2);
assert.equal(Object.values(DEFAULT_WEIGHTS).reduce((a,b)=>a+b,0), 100);
for (const [k,p] of Object.entries(WEIGHT_PRESETS)) { const s=Object.values(p.weights).reduce((a,b)=>a+b,0); assert.ok(Math.abs(s-100)<0.5, k+" sums "+s); }
const all = (score:number, confidence:any="high") => Object.fromEntries(DIMENSIONS.map(d=>[d.key,{score,confidence,rationale:"",sources:[]}])) as any;
assert.equal(composite(all(5)), 100); assert.equal(composite(all(3)), 50); assert.equal(joinerUpside(all(1)), 0);
const flag=[{type:"governance_ethics",severity:"high",detail:"x",source:null}] as any;
assert.equal(personalScore({scores:all(5),redFlags:flag,profileFit:null}),100);
assert.equal(personalScore({scores:all(5),redFlags:flag,penalizeRedFlags:true,profileFit:null}),90);
console.log("hide flagged:", applyPreferences({red_flags:[{severity:"high",detail:"SEC probe"}]},{hide_red_flags_at:"medium"}));
assert.equal(redFlagPenalty(Array(5).fill({type:"x",severity:"high"}) as any), 30);

// Sierra under v2 (my manual scores)
const S=(score:number,confidence:any)=>({score,confidence,rationale:"",sources:[]});
const sierra:any={ market:S(5,"high"), pmf:S(5,"high"), moat:S(3.5,"medium"), competition:S(3.5,"medium"), business_model:S(3.5,"medium"),
  gtm:S(4.5,"high"), independence:S(3.5,"medium"), growth:S(5,"high"), risk_retirement:S(4.5,"high"), capital:S(5,"high"), team:S(5,"high"), ai_positioning:S(5,"high"),
  valuation_headroom:S(3,"medium"), career_velocity:S(5,"high") };
console.log("Sierra v2 winning:", composite(sierra), "| joiner upside:", joinerUpside(sierra));
for (const [k,p] of Object.entries(WEIGHT_PRESETS)) console.log("  preset", k.padEnd(14), personalScore({scores:sierra, userWeights:p.weights, profileFit:null}));

// parse v2
const fake = "ok " + JSON.stringify({summary:"s", facts:{stage:"Series E"}, scores: Object.fromEntries(DIMENSIONS.map(d=>[d.key,{score:4,confidence:"high",rationale:"r",sources:[]}])), red_flags:[{type:"layoffs_or_down_round",severity:"bogus",detail:"d"}], conflicts:["c"]});
const p = parseEvaluation(fake); assert.equal(p.red_flags[0].severity,"low"); assert.equal(p.conflicts.length,1); assert.equal(Object.keys(p.scores).length,14);
console.log("prompt chars:", buildEvaluationPrompt({name:"Sierra"}).length);

// equity by stage
assert.equal(stageBucket("Seed"),"early"); assert.equal(stageBucket("Series B"),"mid"); assert.equal(stageBucket("Series E"),"late"); assert.equal(stageBucket(null),"mid");
for (const st of ["Seed","Series B","Series E"]) { const sc=defaultScenarios(1e9, st); assert.ok(Math.abs(sc.reduce((a,s)=>a+s.probability,0)-1)<1e-9); }
const rounds=defaultFutureRounds("Series E"); const anchor=15.8e9*rounds.reduce((a,r)=>a*r.stepUp,1);
const eq=estimateEquity({grantPct:0.002,currentPostMoneyUsd:15.8e9,currentPreferenceUsd:1.585e9,futureRounds:rounds,preferredOwnershipAtExit:0.35,scenarios:defaultScenarios(15.8e9,"Series E",5)});
console.log("Sierra EV with late-stage defaults:", eq.expectedValueUsd, eq.scenarios.map(s=>s.label+":"+Math.round(s.netValueUsd/1e3)+"K").join(" "));

// roles
const titles=["Product Manager, Agent Development","Product Marketing Manager","Enterprise Account Executive","Forward Deployed Engineer","Chief of Staff to the CEO","Strategy & Operations Lead","Senior Software Engineer","Solutions Engineer","Office Manager"];
console.log(titles.map(t=>t+" -> "+classifyRole(t)).join("\n"));
assert.equal(classifyRole("Product Marketing Manager"),"marketing"); assert.equal(classifyRole("Forward Deployed Engineer"),"fde");

// filters
const r=applyPreferences({stage:"Series E",headcount:700,hq_city:"San Francisco, CA",work_policy:"onsite",sponsors_visas:"unknown",open_roles_by_function:countByFunction(titles.map(t=>({title:t})))},
  {stage_buckets:["early","mid"],locations:["New York"],needs_visa_sponsorship:true,target_functions:["product"],require_open_role:true});
console.log("filters:", r);
assert.equal(r.passes,false); assert.ok(r.unknowns.includes("visa sponsorship"));

// facts: fresh wins over stale list
const u=factsToCompanyUpdate({headcount_estimate:700,total_funding_usd:1.585e9,stage:"Series E"},{headcount:488,total_funding_usd:635e6,hq_city:"San Francisco, CA"});
assert.equal(u.headcount,700); assert.equal(u.total_funding_usd,1.585e9); assert.equal(u.hq_city,"San Francisco, CA");
const u2=factsToCompanyUpdate({},{headcount:488}); assert.equal(u2.headcount,null);
console.log("rev/employee Sierra:", revenuePerEmployee(400e6,700));

assert.ok(Math.abs(spearman([1,2,3,4,5],[2,1,4,3,5])-0.8)<1e-9); assert.equal(spearman([1,2,3],[3,2,1]),-1);
console.log("ALL V2 CHECKS PASSED");
