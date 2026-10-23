import { test } from "node:test";
import assert from "node:assert/strict";
import { COURSE_COLORS, courseColor, lanes, lessonsPassed, placeOn, timelineRange } from "./timetable";

const u = (s: string) => new Date(`${s}T00:00:00Z`);

test("course colour: the chosen one, else a steady pick by course id", () => {
  assert.equal(courseColor({ id: 3, color: "purple" }), "purple");
  assert.equal(courseColor({ id: 1, color: null }), COURSE_COLORS[0]);
  assert.equal(courseColor({ id: 9, color: null }), COURSE_COLORS[0]); // 8 colours, wraps around
  assert.equal(courseColor({ id: 2, color: "neon" }), COURSE_COLORS[1]); // unknown value → fallback
  assert.ok(!(COURSE_COLORS as readonly string[]).includes("red")); // red reads as an error
});

test("timeline: 08:00–22:00, widened to whole half hours for earlier or later lessons", () => {
  assert.deepEqual(timelineRange([{ start: 600, end: 720 }]), { from: 480, to: 1320 });
  assert.deepEqual(timelineRange([{ start: 455, end: 545 }, { start: 1290, end: 1350 }]), { from: 450, to: 1350 });
  assert.deepEqual(timelineRange([{ start: 1300, end: 1335 }]), { from: 480, to: 1350 });
  assert.deepEqual(timelineRange([]), { from: 480, to: 1320 });
});

test("a card sits at its time: share of the timeline from the left, and its width", () => {
  const range = { from: 480, to: 1320 }; // 840 minutes
  assert.deepEqual(placeOn(range, 480, 600), { left: 0, width: (120 / 840) * 100 });
  assert.deepEqual(placeOn(range, 1200, 1320), { left: (720 / 840) * 100, width: (120 / 840) * 100 });
});

test("lessons overlapping in one room stack in lanes; back-to-back ones share a lane", () => {
  const { lane, count } = lanes([
    { id: 1, start: 600, end: 720 },
    { id: 2, start: 660, end: 780 }, // overlaps 1
    { id: 3, start: 720, end: 840 }, // starts as 1 ends
    { id: 4, start: 690, end: 750 }, // overlaps 1 and 2
  ]);
  assert.equal(count, 3);
  assert.equal(lane.get(1), 0);
  assert.equal(lane.get(2), 1);
  assert.equal(lane.get(3), 0);
  assert.equal(lane.get(4), 2);
  assert.deepEqual(lanes([]), { lane: new Map(), count: 1 });
});

test("lessons passed: lesson days from the start up to the day, without holidays or cancelled lessons", () => {
  // Mon/Wed/Fri from Mon 5 Oct 2026: 5, 7, 9, 12, 14 → 5 lessons up to Wed 14 Oct
  const g = { startDate: u("2026-10-05"), days: "ODD", schedules: [] };
  assert.equal(lessonsPassed(g, [], u("2026-10-14")), 5);
  assert.equal(lessonsPassed(g, ["2026-10-07", "2026-10-12"], u("2026-10-14")), 3);
  assert.equal(lessonsPassed(g, [], u("2026-10-04")), 0); // not started yet
});

test("lessons passed follow a schedule change", () => {
  const g = { startDate: u("2026-11-02"), days: "1,3", schedules: [{ from: u("2026-11-02"), days: "ODD" }, { from: u("2026-11-16"), days: "1,3" }] };
  assert.equal(lessonsPassed(g, [], u("2026-11-18")), 8);
});
