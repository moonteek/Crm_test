import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLessonDay, lessonDatesOf, heldLessonsOf, removedLessonDays, scheduleChangeProblem, scheduleOn, scheduleRowsToWrite, schedulesFrom,
  type ScheduleRow, type Scheduled,
} from "./group-schedule";

const d = (iso: string) => new Date(iso + "T00:00:00Z");
const iso = (x: Date) => x.toISOString().slice(0, 10);
const row = (from: string, days: string, time = "14:00", endTime: string | null = null): ScheduleRow => ({ from: d(from), days, time, endTime });
const group = (schedules: ScheduleRow[], now: Partial<Scheduled> = {}): Scheduled => ({ days: "EVEN", time: "16:00", endTime: null, schedules, ...now });

test("schedule: a group never changed uses its own fields", () => {
  assert.deepEqual(scheduleOn(group([]), d("2026-11-10")), { days: "EVEN", time: "16:00", endTime: null });
});

test("schedule: the latest row on or before the day applies; before the first row, the group's fields", () => {
  const g = group([row("2026-11-02", "ODD"), row("2026-11-16", "EVEN", "16:00", "17:30")]);
  assert.equal(scheduleOn(g, d("2026-11-01")).days, "EVEN"); // before any row
  assert.equal(scheduleOn(g, d("2026-11-15")).days, "ODD");
  assert.deepEqual(scheduleOn(g, d("2026-11-16")), { days: "EVEN", time: "16:00", endTime: "17:30" }); // boundary day
});

test("schedule: before a future row the old schedule still applies", () => {
  const g = group([row("2026-10-01", "ODD", "14:00"), row("2026-12-01", "EVEN", "16:00")], { days: "EVEN", time: "16:00" });
  assert.deepEqual(scheduleOn(g, d("2026-11-20")), { days: "ODD", time: "14:00", endTime: null });
  assert.equal(isLessonDay(g, d("2026-11-23")), true); // Monday, ODD
  assert.equal(isLessonDay(g, d("2026-11-24")), false);
  assert.equal(isLessonDay(g, d("2026-12-01")), true); // Tuesday, EVEN from the 1st
});

test("schedule: Sunday is never a lesson day", () => {
  assert.equal(isLessonDay(group([], { days: "DAILY" }), d("2026-11-15")), false);
});

test("schedule: lesson dates of a month split by a change", () => {
  const g = group([row("2026-11-01", "ODD"), row("2026-11-16", "EVEN")]);
  assert.deepEqual(lessonDatesOf(g, 2026, 10).map(iso), [
    "2026-11-02", "2026-11-04", "2026-11-06", "2026-11-09", "2026-11-11", "2026-11-13",
    "2026-11-17", "2026-11-19", "2026-11-21", "2026-11-24", "2026-11-26", "2026-11-28",
  ]);
  assert.deepEqual(heldLessonsOf(g, 2026, 10, ["2026-11-04", "2026-11-19"]).length, 10);
});

test("schedule: the schedules in force on a day and after it", () => {
  const g = group([row("2026-10-01", "ODD", "14:00"), row("2026-12-01", "EVEN", "16:00")]);
  assert.deepEqual(schedulesFrom(g, d("2026-11-20")).map((s) => s.days + " " + s.time), ["ODD 14:00", "EVEN 16:00"]);
  assert.deepEqual(schedulesFrom(g, d("2026-12-05")).map((s) => s.days + " " + s.time), ["EVEN 16:00"]);
  assert.deepEqual(schedulesFrom(group([]), d("2026-12-05")).map((s) => s.days), ["EVEN"]);
});

test("schedule change date: from the 1st of this month, after the start and the latest change, up to 60 days ahead", () => {
  const base = { today: d("2026-11-10"), startDate: d("2026-09-01"), rows: [] as ScheduleRow[] };
  assert.equal(scheduleChangeProblem({ ...base, from: d("2026-10-31") }), "Jadvalni o'tgan oylardan boshlab o'zgartirib bo'lmaydi — eng erta sana: 01.11.2026");
  assert.equal(scheduleChangeProblem({ ...base, from: d("2026-11-01") }), null);
  assert.equal(scheduleChangeProblem({ ...base, from: d("2026-11-10") }), null);
  assert.equal(scheduleChangeProblem({ ...base, from: d("2027-01-09") }), null); // 60 days
  assert.equal(scheduleChangeProblem({ ...base, from: d("2027-01-10") }), "Ko'pi bilan 60 kun oldinga");
  assert.equal(scheduleChangeProblem({ ...base, startDate: d("2026-11-20"), from: d("2026-11-12") }), "Sana guruh boshlanishidan oldin bo'lishi mumkin emas");
  const rows = [row("2026-09-01", "ODD"), row("2026-11-12", "EVEN")];
  assert.equal(scheduleChangeProblem({ ...base, rows, from: d("2026-11-11") }), "Sana oldingi jadval o'zgarishidan (12.11.2026) oldin bo'lishi mumkin emas");
  assert.equal(scheduleChangeProblem({ ...base, rows, from: d("2026-11-12") }), null); // same day replaces it
});

test("schedule change: marked days the new schedule drops, make-up days excepted", () => {
  const marked = ["2026-11-16", "2026-11-17", "2026-11-09"];
  assert.deepEqual(removedLessonDays({ marked, from: d("2026-11-15"), days: "EVEN", makeups: [] }), ["2026-11-16"]);
  assert.deepEqual(removedLessonDays({ marked, from: d("2026-11-15"), days: "EVEN", makeups: ["2026-11-16"] }), []);
  assert.deepEqual(removedLessonDays({ marked: ["2026-11-18", "2026-11-16"], from: d("2026-11-15"), days: "2,4", makeups: [] }), ["2026-11-16", "2026-11-18"]);
});

test("schedule change: the first change writes the old schedule from the start too; later ones add one row", () => {
  const before = { from: d("2026-01-01"), days: "ODD", time: "14:00", endTime: null };
  const next = row("2026-11-16", "EVEN", "16:00");
  assert.deepEqual(scheduleRowsToWrite({ before, startDate: d("2026-09-01"), rows: [], next }), [{ ...before, from: d("2026-09-01") }, next]);
  assert.deepEqual(scheduleRowsToWrite({ before, startDate: d("2026-09-01"), rows: [row("2026-09-01", "ODD")], next }), [next]);
});
