import { test } from "node:test";
import assert from "node:assert/strict";
import { centreMonthStart, centreToday, greeting } from "./schedule";

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

test("centreMonthStart is the 1st of the Tashkent month, even when the server is still in the previous month", () => {
  // 21:00 UTC on 31 Oct is already 02:00 on 1 Nov in Tashkent
  const start = centreMonthStart(new Date("2026-10-31T21:00:00Z"));
  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 10);
  assert.equal(start.getDate(), 1);
});
