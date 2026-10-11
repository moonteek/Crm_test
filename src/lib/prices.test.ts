import { test } from "node:test";
import assert from "node:assert/strict";
import { planPriceChange, priceAt, upcomingPrice } from "./prices";

const d = (y: number, m: number, day = 1) => new Date(Date.UTC(y, m - 1, day));
const EPOCH = new Date(0);

test("no history: the current price applies to every month", () => {
  assert.equal(priceAt([], 450_000, 2026, 9), 450_000);
});

test("a change from November keeps October at the old price", () => {
  const h = [{ price: 450_000, from: EPOCH }, { price: 500_000, from: d(2026, 11) }];
  assert.equal(priceAt(h, 999, 2026, 9), 450_000); // October (month index 9)
  assert.equal(priceAt(h, 999, 2026, 10), 500_000); // November
  assert.equal(priceAt(h, 999, 2026, 11), 500_000); // December
});

test("two changes", () => {
  const h = [{ price: 450_000, from: EPOCH }, { price: 500_000, from: d(2026, 11) }, { price: 550_000, from: d(2027, 1) }];
  assert.equal(priceAt(h, 999, 2026, 11), 500_000);
  assert.equal(priceAt(h, 999, 2027, 0), 550_000);
});

test("history order does not matter", () => {
  const h = [{ price: 500_000, from: d(2026, 11) }, { price: 450_000, from: EPOCH }];
  assert.equal(priceAt(h, 999, 2026, 9), 450_000);
});

test("upcomingPrice shows a change that has not started yet", () => {
  const h = [{ price: 450_000, from: EPOCH }, { price: 500_000, from: d(2026, 11) }];
  assert.deepEqual(upcomingPrice(h, d(2026, 10, 15)), { price: 500_000, from: d(2026, 11) });
  assert.equal(upcomingPrice(h, d(2026, 11, 2)), null);
});

test("planPriceChange: the first change records the old price for earlier months", () => {
  assert.deepEqual(planPriceChange([], 500_000, 450_000, d(2026, 11)), { baseline: 450_000, action: "set" });
});

test("planPriceChange: a second edit in the same month replaces, it doesn't stack", () => {
  const rows = [{ price: 450_000, from: EPOCH }, { price: 500_000, from: d(2026, 11) }];
  assert.deepEqual(planPriceChange(rows, 520_000, 450_000, d(2026, 11)), { baseline: null, action: "set" });
});

test("planPriceChange: setting back to the current price cancels the scheduled change", () => {
  const rows = [{ price: 450_000, from: EPOCH }, { price: 500_000, from: d(2026, 11) }];
  assert.deepEqual(planPriceChange(rows, 450_000, 999, d(2026, 11)), { baseline: null, action: "cancel" });
});

test("planPriceChange: no change when nothing differs", () => {
  assert.deepEqual(planPriceChange([], 450_000, 450_000, d(2026, 11)), { baseline: null, action: "none" });
});
