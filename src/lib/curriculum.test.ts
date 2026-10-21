import { test } from "node:test";
import assert from "node:assert/strict";
import { levelExams, levelWindows, passed, progressLabel, progressOn, sectionLessons, sectionLevels, type CurriculumSubject } from "./curriculum";
import { examColumns } from "./group-exams";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));
const iso = (x: Date) => x.toISOString().slice(0, 10);
const line = (id: number, name: string, levels: number, lessons: number, position = id): CurriculumSubject => ({ id, name, levels, lessons, position });
const HTML = line(1, "HTML", 1, 13);
const CSS = line(2, "CSS", 1, 13);
// Du / Chor / Ju from Monday 7 Sep 2026: the 13th lesson is 5 Oct, the next one 7 Oct
const group = { startDate: d(2026, 9, 7), days: "ODD", startSubjectId: null, startLevel: 1, holidays: [] as string[] };

test("levels count held lessons: 13 lessons per level by default", () => {
  const w = levelWindows(group, [CSS, HTML]); // order comes from position, not the array
  assert.deepEqual(w.map((x) => [x.level, x.label, x.lessons.length, iso(x.from), iso(x.to)]), [
    [1, "HTML", 13, "2026-09-07", "2026-10-05"],
    [2, "CSS", 13, "2026-10-07", "2026-11-04"],
  ]);
});

test("mixed lengths: an 8-lesson level then a 13-lesson one", () => {
  const w = levelWindows(group, [line(1, "Scratch", 1, 8), line(2, "Python", 1, 13)]);
  assert.deepEqual(w.map((x) => x.lessons.length), [8, 13]);
  assert.equal(iso(w[0].to), "2026-09-23");
  assert.equal(iso(w[1].from), "2026-09-25");
});

test("numbered labels for multi-level lines", () => {
  const w = levelWindows(group, [HTML, line(2, "Node.js", 3, 13)]);
  assert.deepEqual(w.map((x) => [x.level, x.label, x.subject, x.levelInSubject, x.subjectLevels]), [
    [1, "HTML", "HTML", 1, 1],
    [2, "Node.js 1", "Node.js", 1, 3],
    [3, "Node.js 2", "Node.js", 2, 3],
    [4, "Node.js 3", "Node.js", 3, 3],
  ]);
  assert.deepEqual(levelExams(group, [HTML, line(2, "Node.js", 3, 13)]).map((e) => e.title), ["HTML imtihoni", "Node.js 1 imtihoni", "Node.js 2 imtihoni", "Node.js 3 imtihoni"]);
});

test("a holiday and a cancelled lesson move the exam and every later level", () => {
  const plain = levelWindows(group, [HTML, CSS]);
  const closed = ["2026-09-09", "2026-09-14"];
  const w = levelWindows({ ...group, holidays: closed }, [HTML, CSS]);
  assert.deepEqual(w.map((x) => iso(x.to)), ["2026-10-09", "2026-11-09"]);
  assert.deepEqual(plain.map((x) => iso(x.to)), ["2026-10-05", "2026-11-04"]);
  assert.ok(w.every((x) => x.lessons.every((l) => !closed.includes(iso(l)))));
  assert.equal(iso(levelExams({ ...group, holidays: closed }, [HTML])[0].date), "2026-10-09");
});

test("a start day that is a holiday and a long run of cancellations still give N lessons", () => {
  const closed = ["2026-09-07", "2026-09-09", "2026-09-11", "2026-09-14", "2026-09-16", "2026-09-18", "2026-09-21"];
  const [w] = levelWindows({ ...group, holidays: closed }, [HTML]);
  assert.equal(w.lessons.length, 13);
  assert.equal(iso(w.from), "2026-09-23");
  assert.ok(w.lessons.every((l) => !closed.includes(iso(l))));
});

test("a group can start part-way: line and level", () => {
  const lines = [HTML, CSS, line(3, "JS", 3, 13)];
  const w = levelWindows({ ...group, startSubjectId: 3, startLevel: 2 }, lines);
  assert.deepEqual(w.map((x) => [x.level, x.label]), [[4, "JS 2"], [5, "JS 3"]]);
  assert.equal(iso(w[0].from), "2026-09-07");
});

test("a start point that no longer exists falls back to the first level", () => {
  const lines = [HTML, CSS, line(3, "JS", 3, 13)];
  assert.equal(levelWindows({ ...group, startSubjectId: 99, startLevel: 2 }, lines)[0].level, 1);
  assert.deepEqual(levelWindows({ ...group, startSubjectId: 3, startLevel: 9 }, lines).map((x) => x.label), ["JS 3"]);
});

test("progress before, during, in the last level and after the section", () => {
  const s = [HTML, CSS];
  const before = progressOn(group, s, d(2026, 9, 1));
  assert.deepEqual([before.state, before.done, before.total], ["not-started", 0, 26]);
  const mid = progressOn(group, s, d(2026, 9, 16));
  assert.deepEqual([mid.state, mid.window?.label, mid.doneInWindow, mid.lessonsInWindow, mid.done, mid.percent], ["in-progress", "HTML", 5, 13, 5, 19]);
  const between = progressOn(group, s, d(2026, 10, 6)); // after HTML's last lesson, before CSS's first
  assert.deepEqual([between.state, between.window?.label, between.doneInWindow, between.done], ["finishing", "CSS", 0, 13]);
  const last = progressOn(group, s, d(2026, 10, 9));
  assert.deepEqual([last.state, last.window?.label, last.doneInWindow, last.done], ["finishing", "CSS", 2, 15]);
  const after = progressOn(group, s, d(2026, 11, 10));
  assert.deepEqual([after.state, after.done, after.percent], ["finished", 26, 100]);
});

test("a section without lines has no curriculum", () => {
  assert.deepEqual(levelWindows(group, []), []);
  assert.equal(progressOn(group, [], d(2026, 9, 16)).state, "none");
});

test("totals of a section", () => {
  const lines = [HTML, line(2, "Node.js", 3, 8)];
  assert.equal(sectionLevels(lines), 4);
  assert.equal(sectionLessons(lines), 37);
});

test("a start stored as Tashkent midnight is that Tashkent day", () => {
  const w = levelWindows({ ...group, startDate: new Date("2026-09-06T19:00:00.000Z") }, [HTML]);
  assert.equal(iso(w[0].from), "2026-09-07");
});

test("scored exams keep their date; unscored ones follow the lessons", () => {
  const exams = [
    { id: 1, level: 1, title: "x", date: d(2026, 10, 2), maxScore: 100, results: [{ studentId: 5, score: 70 }] },
    { id: 2, level: 2, title: "y", date: d(2026, 10, 30), maxScore: 100, results: [] },
  ];
  const cols = examColumns(group, [HTML, CSS], exams, d(2026, 11, 10));
  assert.deepEqual(cols.map((c) => [c.level, iso(c.date)]), [[1, "2026-10-02"], [2, "2026-11-04"]]);
});

test("section progress label", () => {
  const lines = [HTML, CSS, line(3, "JS", 1, 13), line(4, "TS", 1, 13), line(5, "React", 1, 13)];
  const p = progressOn(group, lines, d(2026, 11, 20)); // JS: 7 Nov 6 → lessons from 6 Nov
  assert.equal(p.window?.label, "JS");
  assert.equal(progressLabel("Frontend", p, sectionLevels(lines)), `Frontend · JS · 3/5-daraja · ${p.doneInWindow}/13 dars`);
  assert.equal(progressLabel(null, p, sectionLevels(lines)), `JS · 3/5-daraja · ${p.doneInWindow}/13 dars`);
  assert.equal(progressLabel("Frontend", progressOn(group, [HTML], d(2027, 1, 1)), 1), "Bo'lim tugadi");
});

test("pass mark", () => {
  assert.equal(passed(59, 100, 60), false);
  assert.equal(passed(60, 100, 60), true);
  assert.equal(passed(12, 20, 60), true);
});

test("saving a level exam: unscored exams follow the lessons, a scored one keeps its date", async () => {
  const { levelExamToSave } = await import("./group-exams");
  const exams = levelExams(group, [HTML, CSS]); // HTML exam 5 Oct, CSS exam 4 Nov
  const today = d(2026, 10, 20);
  assert.deepEqual(levelExamToSave(exams, 1, null, today), { title: "HTML imtihoni", date: d(2026, 10, 5) });
  assert.deepEqual(levelExamToSave(exams, 2, null, today), { error: "Imtihon kuni hali kelmagan" });
  assert.deepEqual(levelExamToSave(exams, 9, null, today), { error: "Bu daraja imtihoni topilmadi" });
  // scored on 2 Oct; lessons changed since, the computed date is now later (even in the future): the stored date stays
  assert.deepEqual(levelExamToSave(exams, 2, { date: d(2026, 10, 2), scored: true }, today), { title: "CSS imtihoni", date: d(2026, 10, 2) });
  // a row without results yet follows the lessons like a new one
  assert.deepEqual(levelExamToSave(exams, 1, { date: d(2026, 9, 1), scored: false }, today), { title: "HTML imtihoni", date: d(2026, 10, 5) });
});

test("course length in months comes from its levels: the longest section, 13 lessons ≈ a month", async () => {
  const { courseMonths } = await import("./curriculum");
  assert.equal(courseMonths([{ subjects: [HTML, CSS, line(3, "JS", 3, 13)] }, { subjects: [line(4, "Node.js", 3, 13)] }]), 5);
  assert.equal(courseMonths([{ subjects: [line(1, "Scratch", 1, 8)] }]), 1); // never 0
  assert.equal(courseMonths([{ subjects: [] }]), null); // no levels: the course's own "Davomiylik (oy)"
});

test("a make-up day counts as a lesson", () => {
  const [w] = levelWindows({ ...group, holidays: ["2026-09-09"], extraDays: ["2026-09-12"] }, [HTML]);
  assert.equal(w.lessons.length, 13);
  assert.ok(w.lessons.some((l) => iso(l) === "2026-09-12"));
  assert.equal(iso(w.to), "2026-10-05"); // same end as with no cancel at all
});
