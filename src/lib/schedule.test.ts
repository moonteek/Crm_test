import { test } from "node:test";
import assert from "node:assert/strict";
import { centreToday, greeting } from "./schedule";

test("centreToday uses Tashkent time, not the server's", () => {
  // 20:00 UTC on Saturday 10 Oct is already 01:00 on Sunday 11 Oct in Tashkent
  assert.deepEqual(centreToday(new Date("2026-10-10T20:00:00Z")), { weekday: 0, day: 11, month: 10, year: 2026, hour: 1 });
});

test("centreToday on a Tashkent afternoon", () => {
  assert.deepEqual(centreToday(new Date("2026-10-10T09:30:00Z")), { weekday: 6, day: 10, month: 10, year: 2026, hour: 14 });
});

test("greeting follows the time of day", () => {
  assert.equal(greeting(7), "Xayrli tong");
  assert.equal(greeting(14), "Xayrli kun");
  assert.equal(greeting(19), "Xayrli kech");
  assert.equal(greeting(1), "Xayrli tun");
});
