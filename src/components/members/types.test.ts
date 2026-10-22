import { test } from "node:test";
import assert from "node:assert/strict";
import { joinBillable, toMemberData } from "./types";
import { totalCharges } from "@/lib/billing";

const gs = {
  id: 1, status: "ACTIVE", events: [], discounts: [{ from: new Date(Date.UTC(2026, 10, 1)), to: new Date(Date.UTC(2026, 10, 1)), amount: 200_000 }],
  group: { id: 1, name: "FE-14", days: "ODD", price: null, course: { name: "Frontend", price: 600_000 }, prices: [], schedules: [] },
};

test("discount amounts reach the browser only for staff who see money", () => {
  assert.equal(toMemberData(gs, { id: 1, name: "Ali" }, { money: true, holidays: [] }).discounts?.[0].amount, 200_000);
  assert.deepEqual(toMemberData(gs, { id: 1, name: "Ali" }, { money: false, holidays: [] }).discounts, []);
});

test("transfer preview: the target group's own closed days, not the source group's", () => {
  const target = { id: 2, name: "B", days: "ODD", price: 1_300_000, course: { name: "K", price: 1_300_000 }, prices: [], schedules: [], holidays: ["2026-11-13"] };
  // joining B on 1 Nov: 13 Mon/Wed/Fri lessons, B cancelled 13 Nov → 12 × 100 000
  const charge = totalCharges([joinBillable(target, new Date("2026-11-01T00:00:00Z"))], new Date("2026-11-30T00:00:00Z"));
  assert.equal(charge, 1_200_000);
});
