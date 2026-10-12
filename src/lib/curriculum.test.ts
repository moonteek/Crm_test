import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonthsClamped, levelExams, levelWindows, passed, progressOn } from "./curriculum";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));
const iso = (x: Date) => x.toISOString().slice(0, 10);
const HTML = { id: 1, name: "HTML", months: 1, position: 1 };
const CSS = { id: 2, name: "CSS", months: 2, position: 2 };
const group = { startDate: d(2026, 10, 20), days: "EVEN", startSubjectId: null, startLevel: 1, holidays: [] as string[] };

test("levels are months from the group's start day; lesson counts vary around 13", () => {
  const w = levelWindows(group, [CSS, HTML]); // order comes from position, not the array
  assert.deepEqual(w.map((x) => [x.level, x.subject, x.levelInSubject, x.subjectLevels, iso(x.from), iso(x.to), x.lessons.length]), [
    [1, "HTML", 1, 1, "2026-10-20", "2026-11-19", 14],
    [2, "CSS", 1, 2, "2026-11-20", "2026-12-19", 13],
    [3, "CSS", 2, 2, "2026-12-20", "2027-01-19", 13],
  ]);
});

test("a start on the 31st clamps to short months without drifting", () => {
  assert.deepEqual(addMonthsClamped(d(2027, 1, 31), 1), d(2027, 2, 28));
  const w = levelWindows({ ...group, startDate: d(2027, 1, 31) }, [{ id: 9, name: "AI", months: 3, position: 1 }]);
  assert.deepEqual(w.map((x) => [iso(x.from), iso(x.to)]), [
    ["2027-01-31", "2027-02-27"],
    ["2027-02-28", "2027-03-30"],
    ["2027-03-31", "2027-04-29"],
  ]);
});

test("a start stored as Tashkent midnight is that Tashkent day", () => {
  const w = levelWindows({ ...group, startDate: new Date("2026-10-19T19:00:00.000Z") }, [HTML]);
  assert.equal(iso(w[0].from), "2026-10-20");
});

test("a group can start part-way through its course", () => {
  const w = levelWindows({ ...group, startSubjectId: 2, startLevel: 2 }, [HTML, CSS]);
  assert.deepEqual(w.map((x) => [x.level, x.subject, x.levelInSubject]), [[3, "CSS", 2]]);
});

test("a start level past a shortened subject stays in that subject", () => {
  const w = levelWindows({ ...group, startSubjectId: 2, startLevel: 5 }, [HTML, CSS]);
  assert.deepEqual(w.map((x) => [x.level, x.subject, x.levelInSubject]), [[3, "CSS", 2]]);
  assert.equal(levelWindows({ ...group, startSubjectId: 99, startLevel: 2 }, [HTML, CSS])[0].subject, "HTML");
});

test("progress before, during, in the last level and after the course", () => {
  const s = [HTML, CSS];
  const before = progressOn(group, s, d(2026, 10, 15));
  assert.deepEqual([before.state, before.done, before.total], ["not-started", 0, 40]);
  const mid = progressOn(group, s, d(2026, 11, 5));
  assert.deepEqual([mid.state, mid.window?.subject, mid.doneInWindow, mid.lessonsInWindow, mid.done, mid.percent], ["in-progress", "HTML", 8, 14, 8, 20]);
  const last = progressOn(group, s, d(2027, 1, 10));
  assert.deepEqual([last.state, last.window?.levelInSubject, last.doneInWindow, last.done, last.percent], ["finishing", 2, 9, 36, 90]);
  const after = progressOn(group, s, d(2027, 1, 25));
  assert.deepEqual([after.state, after.done, after.percent], ["finished", 40, 100]);
});

test("a course without subjects has no curriculum", () => {
  assert.deepEqual(levelWindows(group, []), []);
  assert.equal(progressOn(group, [], d(2026, 11, 5)).state, "none");
});

test("level exams are on the last lesson of each level", () => {
  assert.deepEqual(levelExams(group, [HTML, CSS]).map((e) => [e.level, e.title, iso(e.date)]), [
    [1, "HTML · 1-daraja imtihoni", "2026-11-19"],
    [2, "CSS · 1-daraja imtihoni", "2026-12-19"],
    [3, "CSS · 2-daraja imtihoni", "2027-01-19"],
  ]);
});

test("pass mark", () => {
  assert.equal(passed(59, 100, 60), false);
  assert.equal(passed(60, 100, 60), true);
  assert.equal(passed(12, 20, 60), true);
});

test("holidays aren't lessons: the level counts held lessons and the exam moves to the last one", () => {
  const w = levelWindows({ ...group, holidays: ["2026-11-10"] }, [HTML]);
  assert.equal(w[0].lessons.length, 13); // 14 scheduled, one a holiday
  const onExamDay = levelExams({ ...group, holidays: ["2026-11-19"] }, [HTML]);
  assert.equal(iso(onExamDay[0].date), "2026-11-17");
  const allOff = levelWindows(group, [HTML])[0].lessons.map(iso);
  assert.deepEqual(levelExams({ ...group, holidays: allOff }, [HTML]), []);
});
