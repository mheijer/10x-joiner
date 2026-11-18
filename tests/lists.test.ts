import assert from "node:assert/strict";
import { createList, setMembership, renameList, deleteList, listsFor } from "../lib/lists.ts";

let L = createList([], "Interviewing", "sierra");
assert.equal(L.length, 1);
assert.deepEqual(L[0].company_ids, ["sierra"]);
L = createList(L, "  interviewing ", "cloudzero"); // same name (case/space-insensitive) → adds to the existing list
assert.equal(L.length, 1);
assert.deepEqual(L[0].company_ids, ["sierra", "cloudzero"]);
L = createList(L, "Boston fintech");
assert.equal(L.length, 2);
L = setMembership(L, L[1].id, "cloudzero", true);
L = setMembership(L, L[1].id, "cloudzero", true); // no duplicates
assert.deepEqual(L[1].company_ids, ["cloudzero"]);
assert.deepEqual(listsFor(L, "cloudzero").map((l) => l.name), ["Interviewing", "Boston fintech"]);
L = setMembership(L, L[0].id, "sierra", false);
assert.deepEqual(L[0].company_ids, ["cloudzero"]);
L = renameList(L, L[1].id, "Boston");
assert.equal(L[1].name, "Boston");
assert.equal(renameList(L, L[1].id, "  ")[1].name, "Boston", "blank names are ignored");
assert.equal(createList(L, "   ").length, L.length);
assert.equal(deleteList(L, L[0].id).length, 1);
console.log("LISTS OK");
