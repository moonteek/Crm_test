import { test } from "node:test";
import assert from "node:assert/strict";
import { attendancePercent, fillPresent, nextMark, unmarkedToday } from "./attendance";

test("tapping a cell: empty → keldi → kechikdi → kelmadi → empty", () => {
  assert.deepEqual(nextMark(null), { present: true, late: false });
  assert.deepEqual(nextMark({ present: true, late: false }), { present: true, late: true });
  assert.deepEqual(nextMark({ present: true, late: true }), { present: false, late: false });
  assert.equal(nextMark({ present: false, late: false }), null);
});

test("late counts as present", () => {
  assert.equal(attendancePercent([{ present: true, late: false }, { present: true, late: true }, { present: false, late: false }, { present: false, late: false }]), 50);
  assert.equal(attendancePercent([]), null);
});

test("\"Hammasi keldi\" only fills students who aren't marked yet", () => {
  assert.deepEqual(fillPresent([1, 2, 3, 4], new Map([[2, { present: false, late: false }], [3, { present: true, late: true }]])), [1, 4]);
});

test("unmarked today: lesson started, not a holiday, nobody marked", () => {
  // Monday 12 Oct 2026, 11:00 in Tashkent (06:00 UTC)
  const now = new Date("2026-10-12T06:00:00Z");
  const g = (id: number, days: string, time: string, status = "ACTIVE") => ({ id, days, time, status });
  const groups = [g(1, "ODD", "10:00"), g(2, "ODD", "14:00"), g(3, "EVEN", "09:00"), g(4, "ODD", "09:00"), g(5, "ODD", "09:00", "FINISHED")];
  assert.deepEqual(unmarkedToday(groups, new Set([4]), now, []), [1]);
  assert.deepEqual(unmarkedToday(groups, new Set(), now, ["2026-10-12"]), []);
});
