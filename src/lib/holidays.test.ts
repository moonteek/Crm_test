import { test } from "node:test";
import assert from "node:assert/strict";
import { heldLessons } from "./format";
import { canDeleteHoliday, expandRange, holidayProblem } from "./holidays";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));
const iso = (x: Date) => x.toISOString().slice(0, 10);

test("held lessons skip holidays on lesson days only", () => {
  const held = heldLessons("EVEN", 2026, 10, ["2026-11-10"]);
  assert.equal(held.length, 11);
  assert.ok(!held.some((x) => iso(x) === "2026-11-10"));
  assert.equal(heldLessons("EVEN", 2026, 10, ["2026-11-09"]).length, 12); // a Monday: no EVEN lesson
});

test("a date range is every day in between, across a new year", () => {
  assert.deepEqual(expandRange(d(2026, 12, 31), d(2027, 1, 2)).map(iso), ["2026-12-31", "2027-01-01", "2027-01-02"]);
  assert.deepEqual(expandRange(d(2026, 11, 10), null).map(iso), ["2026-11-10"]);
});

test("holiday rules", () => {
  const today = d(2026, 10, 12);
  assert.equal(holidayProblem([d(2026, 11, 10)], [], today), null);
  assert.equal(holidayProblem([d(2026, 10, 1)], [], today), null); // this month, already past: allowed
  assert.equal(holidayProblem([d(2026, 9, 30)], [], today), "Bayram kunlari shu oydan boshlab qo'shiladi");
  assert.equal(holidayProblem([d(2026, 11, 10)], [{ date: d(2026, 11, 10), name: "Test" }], today), "10.11.2026 allaqachon bayram: Test");
  assert.equal(holidayProblem(expandRange(d(2026, 11, 1), d(2026, 12, 5)), [], today), "Oraliq 31 kundan oshmasin");
  assert.equal(holidayProblem([], [], today), "Tugash sanasi boshlanishdan oldin");
});

test("only future holidays can be deleted", () => {
  const today = new Date("2026-11-10T08:00:00Z"); // 13:00 in Tashkent
  assert.equal(canDeleteHoliday(d(2026, 11, 10), today), false);
  assert.equal(canDeleteHoliday(d(2026, 11, 11), today), true);
});
