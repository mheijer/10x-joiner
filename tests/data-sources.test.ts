// New free data sources: job-system detection from careers pages, SEC Form D, openFDA, ClinicalTrials.gov.
// Parsers only (no network): fixtures shaped like each API's real responses.
import assert from "node:assert/strict";
import { atsFromHtml, boardUrl } from "../lib/jobs.ts";
import { parseFormDSearch, parseFormDXml, parseFda, parseTrials } from "../lib/signals.ts";

// ---- careers page → job system
const html = `
  <a href="https://job-boards.greenhouse.io/sierra">Open roles</a>
  <script src="https://boards.greenhouse.io/embed/job_board/js?for=cloudzero"></script>
  <iframe src="https://jobs.ashbyhq.com/Mendaera/embed"></iframe>
  <a href="https://jobs.lever.co/nuance-labs/abc">x</a>
  <a href="https://apply.workable.com/acme-ai/">x</a>
  <a href="https://careers.smartrecruiters.com/ExampleCo">x</a>`;
const found = atsFromHtml(html);
const has = (p: string, s: string) => found.some((f) => f.provider === p && f.slug === s);
assert.ok(has("greenhouse", "sierra"), "greenhouse board link");
assert.ok(has("greenhouse", "cloudzero"), "greenhouse embed ?for=");
assert.ok(has("ashby", "mendaera"), "ashby, lowercased");
assert.ok(has("lever", "nuance-labs"));
assert.ok(has("workable", "acme-ai"));
assert.ok(has("smartrecruiters", "exampleco"));
assert.ok(!found.some((f) => ["embed", "apply", "js"].includes(f.slug)), "path words are never slugs");
assert.deepEqual(atsFromHtml("<p>We are hiring! Email jobs@acme.com</p>"), []);
assert.equal(boardUrl("workable", "acme-ai"), "https://apply.workable.com/acme-ai/");

// ---- SEC Form D (EDGAR full-text search + primary_doc.xml)
const search = {
  hits: { hits: [
    { _id: "0001234567-25-000002:primary_doc.xml", _source: { ciks: ["0001234567"], display_names: ["CloudZero, Inc.  (CIK 0001234567)"], file_date: "2025-05-20", adsh: "0001234567-25-000002" } },
    { _id: "0001234567-23-000001:primary_doc.xml", _source: { ciks: ["0001234567"], display_names: ["CloudZero, Inc.  (CIK 0001234567)"], file_date: "2023-06-12", adsh: "0001234567-23-000001" } },
    { _id: "0009999999-24-000001:primary_doc.xml", _source: { ciks: ["0009999999"], display_names: ["CloudZero Fund I, LP  (CIK 0009999999)"], file_date: "2024-01-01", adsh: "0009999999-24-000001" } },
  ] },
};
const f = parseFormDSearch(search, "CloudZero");
assert.equal(f.length, 2, "only the exact entity, never a similarly named fund");
assert.equal(f[0].filed, "2025-05-20", "newest first");
assert.equal(f[0].cik, "1234567", "leading zeros dropped for the archive path");
assert.equal(f[0].entity, "CloudZero, Inc.");
const xml = `<edgarSubmission><offeringData><typesOfSecuritiesOffered><isEquityType>true</isEquityType></typesOfSecuritiesOffered>
  <offeringSalesAmounts><totalOfferingAmount>56000000</totalOfferingAmount><totalAmountSold>56000000</totalAmountSold></offeringSalesAmounts>
  <dateOfFirstSale><value>2025-05-15</value></dateOfFirstSale></offeringData></edgarSubmission>`;
assert.deepEqual(parseFormDXml(xml), { offered: 56e6, sold: 56e6, firstSale: "2025-05-15" });
assert.deepEqual(parseFormDXml("<x/>"), { offered: null, sold: null, firstSale: null });

// ---- openFDA (510(k) + PMA)
const k510 = { results: [
  { k_number: "K243210", applicant: "MENDAERA, INC.", device_name: "Handheld robotic needle guidance", decision_date: "20250115" },
  { k_number: "DEN230001", applicant: "Mendaera Inc", device_name: "Earlier system", decision_date: "20231101" },
  { k_number: "K111111", applicant: "Other Medical Co", device_name: "Unrelated", decision_date: "20240101" },
] };
const fda = parseFda(k510, null, "Mendaera");
assert.equal(fda.length, 2, "only the company's own decisions");
assert.equal(fda[0].date, "2025-01-15");
assert.equal(fda[1].kind, "De Novo");
assert.deepEqual(parseFda(null, null, "Mendaera"), []);

// ---- ClinicalTrials.gov v2
const trials = { totalCount: 3, studies: [
  { protocolSection: { statusModule: { overallStatus: "RECRUITING", startDateStruct: { date: "2026-02" } }, designModule: { phases: ["PHASE2"] } } },
  { protocolSection: { statusModule: { overallStatus: "COMPLETED", startDateStruct: { date: "2024-05" } }, designModule: { phases: ["PHASE1"] } } },
  { protocolSection: { statusModule: { overallStatus: "NOT_YET_RECRUITING", startDateStruct: { date: "2026-09" } }, designModule: { phases: ["PHASE2"] } } },
] };
assert.deepEqual(parseTrials(trials), { total: 3, active: 2, phases: ["PHASE1", "PHASE2"], latest: "2026-09" });
assert.equal(parseTrials(null).total, 0);
console.log("DATA SOURCES OK");
