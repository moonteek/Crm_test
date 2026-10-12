import { test } from "node:test";
import assert from "node:assert/strict";
import { searchWhere } from "./search";
import { debtorMatches } from "./debtor-status";

test("search needs two characters and looks at the name and every phone", () => {
  assert.equal(searchWhere(" a "), null);
  assert.deepEqual(searchWhere(" Ali "), { OR: [{ name: { contains: "Ali" } }, { phone: { contains: "Ali" } }, { phone2: { contains: "Ali" } }, { parentPhone: { contains: "Ali" } }] });
});

test("debtor status filter: current group or left", () => {
  const active = { groups: [{ leftAt: null }, { leftAt: new Date() }] };
  const left = { groups: [{ leftAt: new Date() }] };
  assert.deepEqual([debtorMatches(active, "active"), debtorMatches(active, "left"), debtorMatches(active, "all")], [true, false, true]);
  assert.deepEqual([debtorMatches(left, "active"), debtorMatches(left, "left")], [false, true]);
});
