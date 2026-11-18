// The app's 100-company sample: right size, no duplicates, keeps the companies already evaluated, all on the list.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_NAMES, inSample } from "../lib/sample.ts";

assert.equal(SAMPLE_NAMES.length, 100);
assert.equal(new Set(SAMPLE_NAMES.map((n) => n.toLowerCase())).size, 100, "no duplicates");
for (const k of ["Sierra", "CloudZero", "Mendaera"]) assert.ok(inSample(k), `${k} kept (already evaluated)`);
assert.ok(inSample("sierra"), "case-insensitive");
const list = readFileSync("data/rocketship_2026_us.csv", "utf8");
for (const n of SAMPLE_NAMES) assert.ok(list.includes(n), `${n} is on the Rocketship List`);
console.log("SAMPLE OK");

// Public companies are out of scope (Nov 17)
import { inApp, isPublicCompany } from "../lib/scope.ts";
assert.equal(isPublicCompany("Public"), true);
assert.equal(isPublicCompany("IPO (2026)"), true);
assert.equal(isPublicCompany("Series D+"), false);
assert.equal(isPublicCompany(null), false);
assert.equal(inApp({ name: "Sierra", is_seed: true, stage: "Series D+" }), true);
assert.equal(inApp({ name: "Sierra", is_seed: true, stage: "Public" }), false, "public companies are hidden");
assert.equal(inApp({ name: "Not In Sample Co", is_seed: true, stage: "Series B" }), false);
assert.equal(inApp({ name: "Anything", is_seed: false, stage: "Series A" }), true, "user-added companies show");
console.log("SCOPE OK");
