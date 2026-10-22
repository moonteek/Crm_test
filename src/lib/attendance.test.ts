import { test } from "node:test";
import assert from "node:assert/strict";
import { attendancePercent, fillPresent, markWrite, unmarkedToday } from "./attendance";

test("cell popover: each choice writes its mark; keldi/kechikdi drop a reason, kelmadi keeps it", () => {
  assert.deepEqual(markWrite("present"), { present: true, late: false, reasonId: null });
  assert.deepEqual(markWrite("late"), { present: true, late: true, reasonId: null });
  assert.deepEqual(markWrite("absent"), { present: false, late: false });
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
  const g = (id: number, days: string, time: string, status = "ACTIVE") => ({ id, days, time, status, schedules: [] });
  const groups = [g(1, "ODD", "10:00"), g(2, "ODD", "14:00"), g(3, "EVEN", "09:00"), g(4, "ODD", "09:00"), g(5, "ODD", "09:00", "FINISHED")];
  assert.deepEqual(unmarkedToday(groups, new Set([4]), now, []), [1]);
  assert.deepEqual(unmarkedToday(groups, new Set(), now, ["2026-10-12"]), []);
});


test("unmarked today ignores groups that haven't started or have nobody to mark", () => {
  const now = new Date("2026-10-12T06:00:00Z"); // Monday 11:00 Tashkent
  const g = (id: number, extra: Partial<{ startDate: Date; members: number }> = {}) => ({ id, days: "ODD", time: "10:00", status: "ACTIVE", schedules: [], startDate: new Date("2026-09-01T00:00:00Z"), members: 5, ...extra });
  assert.deepEqual(unmarkedToday([g(1), g(2, { startDate: new Date("2026-10-19T00:00:00Z") }), g(3, { members: 0 })], new Set(), now, []), [1]);
});

test("unmarked today includes a make-up lesson held today off the group's usual days", () => {
  const now = new Date("2026-10-12T06:00:00Z"); // Monday 11:00 Tashkent
  const g = { id: 1, days: "EVEN", time: "10:00", status: "ACTIVE", schedules: [], startDate: new Date("2026-09-01T00:00:00Z"), members: 5 };
  assert.deepEqual(unmarkedToday([g], new Set(), now, []), []);
  assert.deepEqual(unmarkedToday([{ ...g, makeupToday: true }], new Set(), now, []), [1]);
});

test("unmarked today follows the schedule of today, not a change still to come", () => {
  const now = new Date("2026-11-09T10:00:00Z"); // Monday 15:00 Tashkent
  const g = { id: 1, status: "ACTIVE", days: "EVEN", time: "16:00", schedules: [{ from: new Date("2026-09-01T00:00:00Z"), days: "ODD", time: "14:00" }, { from: new Date("2026-11-16T00:00:00Z"), days: "EVEN", time: "16:00" }] };
  assert.deepEqual(unmarkedToday([g], new Set(), now, []), [1]);
  assert.deepEqual(unmarkedToday([g], new Set(), new Date("2026-11-23T10:00:00Z"), []), []); // Monday after the change
});
