import { test } from "node:test";
import assert from "node:assert/strict";
import { toMemberData } from "./types";

const gs = {
  id: 1, status: "ACTIVE", events: [], discounts: [{ from: new Date(Date.UTC(2026, 10, 1)), to: new Date(Date.UTC(2026, 10, 1)), amount: 200_000 }],
  group: { id: 1, name: "FE-14", days: "ODD", price: null, course: { name: "Frontend", price: 600_000 }, prices: [] },
};

test("discount amounts reach the browser only for staff who see money", () => {
  assert.equal(toMemberData(gs, { id: 1, name: "Ali" }, { money: true }).discounts?.[0].amount, 200_000);
  assert.deepEqual(toMemberData(gs, { id: 1, name: "Ali" }, { money: false }).discounts, []);
});
