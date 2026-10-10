import { test } from "node:test";
import assert from "node:assert/strict";
import { eventsFromLegacy } from "./membership-legacy";

const d = (s: string) => new Date(s);

test("a current member gets one ACTIVATE on the day they joined", () => {
  assert.deepEqual(eventsFromLegacy(d("2026-09-03T00:00:00Z"), null), [{ type: "ACTIVATE", date: d("2026-09-03T00:00:00Z") }]);
});

test("a member who left also gets a LEAVE", () => {
  assert.deepEqual(eventsFromLegacy(d("2026-01-02T00:00:00Z"), d("2026-05-15T00:00:00Z")), [
    { type: "ACTIVATE", date: d("2026-01-02T00:00:00Z") },
    { type: "LEAVE", date: d("2026-05-15T00:00:00Z") },
  ]);
});

test("times of day are dropped", () => {
  assert.deepEqual(eventsFromLegacy(d("2026-09-03T11:47:00Z"), d("2026-09-19T18:15:00Z")), [
    { type: "ACTIVATE", date: d("2026-09-03T00:00:00Z") },
    { type: "LEAVE", date: d("2026-09-19T00:00:00Z") },
  ]);
});

test("a legacy row that left before it joined becomes a free trial that left, as the old code charged nothing", () => {
  assert.deepEqual(eventsFromLegacy(d("2026-09-20T00:00:00Z"), d("2026-09-10T00:00:00Z")), [
    { type: "TRIAL", date: d("2026-09-20T00:00:00Z") },
    { type: "LEAVE", date: d("2026-09-20T00:00:00Z") },
  ]);
});
