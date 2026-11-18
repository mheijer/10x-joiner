// Plain-English reading of scores used by the company panel.
import assert from "node:assert/strict";
import { band, gradeWord, firstSentence, strengthsAndWatchouts, QUADRANT_INFO, quadrant } from "../lib/display.ts";
import { DEFAULT_WEIGHTS } from "../lib/rubric.ts";

assert.equal(band(86), "Strong");
assert.equal(band(60), "Good");
assert.equal(band(49), "Mixed");
assert.equal(band(30), "Weak");
assert.equal(band(null), "Not scored");
assert.equal(gradeWord(5), "Excellent");
assert.equal(gradeWord(3), "Fair");
assert.equal(gradeWord(1), "Poor");
for (const q of ["Pursue", "Blue chip", "Lottery ticket", "Pass"]) assert.ok(QUADRANT_INFO[q], q);
assert.ok(QUADRANT_INFO[quadrant(86, 71)!]);

assert.equal(firstSentence("Top-3 player. Lots more detail here."), "Top-3 player.");
assert.equal(firstSentence("No period at all"), "No period at all");
assert.ok(firstSentence("x".repeat(300)).length <= 160);

const g = (score: number) => ({ score, confidence: "high", rationale: `Grade ${score}. More.` });
const scores: any = { market: g(5), pmf: g(5), growth: g(4), moat: g(3), competition: g(2), independence: g(2.5), team: g(5), valuation_headroom: g(1) };
const { strengths, watchouts } = strengthsAndWatchouts(scores, DEFAULT_WEIGHTS as any);
assert.equal(strengths.length, 3);
assert.equal(strengths[0].key, "pmf", "highest grade x weight first (pmf weight 15)");
assert.deepEqual(watchouts.map((w) => w.key), ["competition", "independence"], "only winning dims, lowest first");
assert.ok(!watchouts.some((w) => w.key === "valuation_headroom"), "joiner dims are not in winning weights");

// No low grades → the lowest ones are still shown as watch-outs, never overlapping strengths
const good: any = { market: g(5), pmf: g(4), growth: g(4), moat: g(3.5) };
const r2 = strengthsAndWatchouts(good, DEFAULT_WEIGHTS as any);
assert.ok(r2.watchouts.length > 0 && !r2.watchouts.some((w) => r2.strengths.some((s) => s.key === w.key)));
console.log("PANEL DISPLAY OK");
