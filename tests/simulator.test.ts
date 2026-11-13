// Equity simulator: offer modes, vesting cliff, RSUs vs options, user edits move the result in the right direction.
import assert from "node:assert/strict";
import { defaultSim, runSim, vestedFraction, grantPctFor } from "../lib/simulator.ts";

const co = { name: "Acme", stage: "Series B", pmfScore: 4, latest_post_money_usd: 1e9, post_money_is_estimate: false, total_funding_usd: 150e6 };
const { state, sources } = defaultSim(co, { usd: 200000, source: "test" });
assert.equal(sources.bucket, "mid");
assert.equal(state.instrument, "options");
assert.equal(state.postMoneyUsd, 1e9);

// Estimate mode: mid = 0.9x base / valuation
assert.ok(Math.abs(grantPctFor(state, "mid") - 0.018) < 1e-9);
const r = runSim(state, "mid");
assert.ok(r.expectedValueUsd > 0 && r.exerciseCostUsd > 0 && r.breakEvenExitUsd! > 0);
assert.equal(r.totalCompPerYearUsd, 200000 + r.equityPerYearUsd);

// Vesting cliff
assert.equal(vestedFraction(0.5), 0);
assert.equal(vestedFraction(2), 0.5);
assert.equal(runSim({ ...state, yearsStay: 0.5 }, "mid").expectedValueUsd, 0);
assert.ok(runSim({ ...state, yearsStay: 2 }, "mid").expectedValueUsd < r.expectedValueUsd);

// Shares mode: 100k of 100M shares = 0.1%
const sh = { ...state, offerMode: "shares" as const, shares: 100000, fullyDilutedShares: 100e6, strikeUsd: 2 };
assert.ok(Math.abs(grantPctFor(sh, "mid") - 0.1) < 1e-9);
assert.equal(runSim(sh, "mid").exerciseCostUsd, 200000);

// RSUs: no exercise cost
assert.equal(runSim({ ...state, instrument: "RSUs" }, "mid").exerciseCostUsd, 0);

// More dilution → less value; bigger rocketship → more value
const moreDil = { ...state, rounds: state.rounds.map((x) => ({ ...x, dilution: x.dilution + 0.1 })) };
assert.ok(runSim(moreDil, "mid").expectedValueUsd < r.expectedValueUsd);
const bigger = { ...state, scenarios: state.scenarios.map((x) => (x.label === "Rocketship" ? { ...x, multiple: x.multiple * 2 } : x)) };
assert.ok(runSim(bigger, "mid").expectedValueUsd > r.expectedValueUsd);

// No valuation: falls back to 5x raised, labeled
const nov = defaultSim({ ...co, latest_post_money_usd: null }, { usd: 200000, source: "t" });
assert.equal(nov.state.postMoneyUsd, 750e6);
assert.match(nov.sources.valuation, /rough guess/);
// Company-specific odds: a stronger company busts less; 60 = stage table; always sums to 100
import { companyOdds } from "../lib/simulator.ts";
const strong = companyOdds("mid", 86), avg = companyOdds("mid", 60), weak = companyOdds("mid", 40);
assert.ok(strong[0].probability < avg[0].probability && avg[0].probability < weak[0].probability);
assert.equal(avg[0].probability, 30);
for (const o of [strong, avg, weak]) assert.equal(o.reduce((a, x) => a + x.probability, 0), 100);
console.log("SIMULATOR OK", { ev: r.expectedValueUsd, perYear: r.equityPerYearUsd, breakEven: r.breakEvenExitUsd });
