import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultAmount, editDiff, monthOptions, parsePaymentFilters } from "./payments";

test("the form suggests the debt, else the monthly price", () => {
  assert.equal(defaultAmount(-450_000, 600_000), 450_000);
  assert.equal(defaultAmount(0, 600_000), 600_000);
  assert.equal(defaultAmount(120_000, 600_000), 600_000);
});

test("which-month choices: previous, current and three ahead", () => {
  assert.deepEqual(monthOptions(new Date(Date.UTC(2026, 11, 15))).map((o) => [o.value, o.label]), [
    ["2026-11", "Noyabr 2026"], ["2026-12", "Dekabr 2026"], ["2027-01", "Yanvar 2027"], ["2027-02", "Fevral 2027"], ["2027-03", "Mart 2027"],
  ]);
});

test("an edit shows only what changed", () => {
  const before = { amount: 780_000, method: "CASH", date: "2026-10-07", month: "2026-10", note: null };
  assert.equal(editDiff(before, { ...before, amount: 790_000 }), "780 000 → 790 000");
  assert.equal(editDiff(before, { ...before, method: "CARD", month: "2026-11" }), "Naqd → Karta, oy: Oktabr 2026 → Noyabr 2026");
  assert.equal(editDiff(before, before), "");
});

test("payment filters default to this month", () => {
  const f = parsePaymentFilters({}, new Date(Date.UTC(2026, 9, 12)));
  assert.deepEqual([f.from.toISOString().slice(0, 10), f.to.toISOString().slice(0, 10), f.q, f.method], ["2026-10-01", "2026-10-31", "", null]);
  const g = parsePaymentFilters({ from: "2026-09-05", to: "2026-09-20", method: "CARD", hodim: "3", group: "x" }, new Date());
  assert.deepEqual([g.from.toISOString().slice(0, 10), g.to.toISOString().slice(0, 10), g.method, g.userId, g.groupId], ["2026-09-05", "2026-09-20", "CARD", 3, null]);
});
