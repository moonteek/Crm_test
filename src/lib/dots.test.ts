import { test } from "node:test";
import assert from "node:assert/strict";
import { dotCounts } from "./dots";

test("small totals show one dot each", () => {
  assert.deepEqual(dotCounts(3, 5), { total: 5, filled: 3 });
});

test("large totals are scaled down to 12 dots", () => {
  assert.deepEqual(dotCounts(11, 15), { total: 12, filled: 9 });
});

test("values are clamped between empty and full", () => {
  assert.deepEqual(dotCounts(20, 15), { total: 12, filled: 12 });
  assert.deepEqual(dotCounts(-2, 5), { total: 5, filled: 0 });
});

test("a zero or missing maximum shows nothing", () => {
  assert.deepEqual(dotCounts(4, 0), { total: 0, filled: 0 });
});
