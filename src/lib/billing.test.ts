import { test } from "node:test";
import assert from "node:assert/strict";
import { balance, billableLessonsIn, billedStudentCount, chargeChangeIf, chargeLines, previewCharge, totalCharges, type BillableMembership } from "./billing";
import type { EventType } from "./membership";

// November 2026: EVEN (Tue/Thu/Sat) has 12 lessons — 3,5,7,10,12,14,17,19,21,24,26,28;
// ODD (Mon/Wed/Fri) has 13 — 2,4,6,9,11,13,16,18,20,23,25,27,30; DAILY (Mon–Sat) has 25.
const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));
const nov = (day: number) => d(2026, 11, day);
const NOW = nov(15);

function member(days: string, price: number, ...events: [EventType, Date][]): BillableMembership {
  return { groupId: 1, group: { name: "G", days, course: { price } }, events: events.map(([type, date]) => ({ type, date })) };
}
const even = (...e: [EventType, Date][]) => member("EVEN", 600_000, ...e);
const odd = (...e: [EventType, Date][]) => member("ODD", 650_000, ...e);
const novCharge = (m: BillableMembership, now = NOW) =>
  chargeLines(m, now).find((l) => l.year === 2026 && l.month === 10)?.amount ?? 0;

test("joining as active on the 5th lesson day pays 8 of 12 lessons", () => {
  assert.equal(novCharge(even(["ACTIVATE", nov(12)])), 400_000);
});

test("freezing after 4 lessons pays those 4, the freeze day included", () => {
  assert.equal(novCharge(even(["ACTIVATE", nov(1)], ["FREEZE", nov(10)])), 200_000);
});

test("paid the full month, then frozen: the unused lessons become credit", () => {
  assert.equal(balance([even(["ACTIVATE", nov(1)], ["FREEZE", nov(10)])], [{ amount: 600_000 }], NOW), 400_000);
});

test("trial lessons are free; charging starts on activation", () => {
  assert.equal(novCharge(even(["TRIAL", nov(3)], ["ACTIVATE", nov(10)])), 450_000);
});

test("a trial that never activates costs nothing", () => {
  assert.equal(totalCharges([even(["TRIAL", nov(3)], ["LEAVE", nov(15)])], NOW), 0);
});

test("October uses the old full-month rule, November is per lesson", () => {
  const m = even(["ACTIVATE", d(2026, 10, 15)], ["LEAVE", nov(20)]);
  const lines = chargeLines(m, d(2026, 12, 15));
  assert.deepEqual(lines.map((l) => [l.month, l.amount, l.legacy]), [[9, 600_000, true], [10, 400_000, false]]);
});

test("transfer on 10 Nov: the old group charges up to the 10th, the new one from the 10th", () => {
  assert.equal(novCharge(even(["ACTIVATE", nov(1)], ["LEAVE", nov(10)])), 200_000);
  assert.equal(novCharge(odd(["ACTIVATE", nov(10)])), 450_000);
});

test("added as trial in October, before the switch: October is not charged", () => {
  const lines = chargeLines(even(["TRIAL", d(2026, 10, 20)], ["ACTIVATE", nov(3)]), NOW);
  assert.deepEqual(lines.map((l) => [l.month, l.amount]), [[10, 600_000]]);
});

test("a freeze recorded late still charges that month partly and later months nothing", () => {
  const m = even(["ACTIVATE", d(2026, 9, 1)], ["FREEZE", nov(10)]);
  const lines = chargeLines(m, d(2027, 1, 15));
  assert.deepEqual(lines.map((l) => [l.year, l.month, l.amount]), [[2026, 8, 600_000], [2026, 9, 600_000], [2026, 10, 200_000]]);
});

test("leaving and joining the same group again bills both spans", () => {
  assert.equal(novCharge(odd(["ACTIVATE", nov(1)], ["LEAVE", nov(9)], ["ACTIVATE", nov(20)])), 450_000);
});

test("freeze and unfreeze on the same day bill that lesson once", () => {
  assert.equal(novCharge(even(["ACTIVATE", nov(1)], ["FREEZE", nov(10)], ["UNFREEZE", nov(10)])), 600_000);
});

test("two freezes in one month", () => {
  const m = even(["ACTIVATE", nov(1)], ["FREEZE", nov(5)], ["UNFREEZE", nov(12)], ["FREEZE", nov(19)], ["UNFREEZE", nov(26)]);
  assert.equal(novCharge(m), 400_000);
});

test("daily groups: 25 lessons in November", () => {
  assert.equal(novCharge(member("DAILY", 600_000, ["ACTIVATE", nov(1)])), 600_000);
  assert.equal(novCharge(member("DAILY", 600_000, ["ACTIVATE", nov(1)], ["FREEZE", nov(7)])), 144_000);
});

test("a full month costs exactly the price, whatever the lesson count", () => {
  assert.equal(novCharge(odd(["ACTIVATE", nov(1)])), 650_000);
  assert.equal(novCharge(member("ODD", 600_000, ["ACTIVATE", nov(1)])), 600_000);
});

test("the current month is charged in full; next month is not charged yet", () => {
  const lines = chargeLines(even(["ACTIVATE", nov(1)]), NOW);
  assert.deepEqual(lines.map((l) => [l.month, l.lessons, l.billable, l.amount]), [[10, 12, 12, 600_000]]);
});

test("a member since January: 10 full legacy months, then November per lesson", () => {
  assert.equal(totalCharges([even(["ACTIVATE", d(2026, 1, 2)])], NOW), 6_600_000);
});

test("billableLessonsIn counts the lessons charged in one month", () => {
  const m = even(["ACTIVATE", nov(1)], ["FREEZE", nov(10)]);
  assert.equal(billableLessonsIn(m, 2026, 10, NOW), 4);
  assert.equal(billableLessonsIn(m, 2026, 11, d(2026, 12, 20)), 0);
});

test("previewCharge shows what a freeze would cost this month", () => {
  const p = previewCharge(even(["ACTIVATE", nov(1)]), { type: "FREEZE", date: nov(10) });
  assert.deepEqual(p, { year: 2026, month: 10, lessons: 12, billable: 4, amount: 200_000, legacy: false, from: nov(3), to: nov(10) });
});

test("previewCharge for activating mid-month", () => {
  const p = previewCharge(even(["TRIAL", nov(3)]), { type: "ACTIVATE", date: nov(10) });
  assert.equal(p.amount, 450_000);
  assert.deepEqual([p.from, p.to], [nov(10), nov(28)]);
});

test("a preview is always per lesson, because the action being previewed is itself new", () => {
  // EVEN October: lessons up to the 12th are 1,3,6,8,10 → 5 of 14
  const p = previewCharge(even(["ACTIVATE", d(2026, 9, 1)]), { type: "FREEZE", date: d(2026, 10, 12) });
  assert.equal(p.legacy, false);
  assert.equal(p.amount, Math.round((600_000 * 5) / 14));
});

test("billedStudentCount: only students charged at least one lesson that month count", () => {
  const ms = [
    even(["ACTIVATE", nov(1)]), // full month
    even(["ACTIVATE", nov(1)], ["FREEZE", nov(10)]), // partial: counts
    even(["TRIAL", nov(3)]), // trial only: free, does not count
    even(["ACTIVATE", d(2026, 9, 1)], ["FREEZE", d(2026, 10, 20)]), // frozen all November: does not count
  ];
  assert.equal(billedStudentCount(ms, 2026, 10, NOW), 2);
  assert.equal(billedStudentCount(ms, 2026, 9, NOW), 1);
});

test("chargeChangeIf: a late freeze also cancels the months after it, up to now", () => {
  const m = odd(["ACTIVATE", d(2026, 9, 1)]);
  m.group.course.price = 600_000;
  // ODD: 13 lessons in Nov, freeze on 20 Nov keeps 9 of them; December (13 lessons) is no longer charged
  assert.equal(chargeChangeIf(m, { type: "FREEZE", date: nov(20) }, d(2026, 12, 5)), -184_615 - 600_000);
});

test("a membership with no events yet (not migrated) is billed from joinedAt / leftAt", () => {
  const m = { ...even(), joinedAt: d(2026, 9, 3), leftAt: null };
  assert.equal(totalCharges([m], NOW), 600_000 * 2 + 600_000);
});

// October 2026: EVEN has 14 lessons (1,3,6,8,10,13,15,17,20,22,24,27,29,31); ODD has 13 (2,5,7,9,12,14,16,19,21,23,26,28,30)
const oct = (day: number) => d(2026, 10, day);

test("a group's own price overrides the course price", () => {
  const m = even(["ACTIVATE", nov(1)]);
  m.group.price = 500_000;
  assert.equal(novCharge(m), 500_000);
  m.group.price = null;
  assert.equal(novCharge(m), 600_000);
});

test("a transfer made in the new screens in October is split per lesson in both groups", () => {
  const old: BillableMembership = { groupId: 1, group: { name: "ROBO-3", days: "EVEN", course: { price: 450_000 } }, events: [
    { type: "ACTIVATE", date: d(2026, 9, 1), migrated: true },
    { type: "LEAVE", date: oct(20), migrated: false },
  ] };
  const next: BillableMembership = { groupId: 2, group: { name: "FE-14", days: "ODD", course: { price: 600_000 } }, events: [
    { type: "ACTIVATE", date: oct(20), migrated: false },
  ] };
  const now = d(2026, 11, 15);
  assert.deepEqual(chargeLines(old, now).map((l) => [l.month, l.amount, l.legacy]), [[8, 450_000, true], [9, 289_286, false]]);
  assert.deepEqual(chargeLines(next, now).map((l) => [l.month, l.amount, l.legacy]), [[9, 230_769, false], [10, 600_000, false]]);
});

test("months with only migrated history keep the full-month rule", () => {
  const m: BillableMembership = { groupId: 1, group: { name: "G", days: "EVEN", course: { price: 450_000 } }, events: [
    { type: "ACTIVATE", date: d(2026, 9, 1), migrated: true },
    { type: "LEAVE", date: oct(20), migrated: true },
  ] };
  assert.equal(chargeLines(m, d(2026, 11, 15)).find((l) => l.month === 9)?.amount, 450_000);
});

test("previewing an action in October shows the per-lesson amount", () => {
  const m: BillableMembership = { groupId: 1, group: { name: "G", days: "EVEN", course: { price: 450_000 } }, events: [
    { type: "ACTIVATE", date: d(2026, 9, 1), migrated: true },
  ] };
  const p = previewCharge(m, { type: "FREEZE", date: oct(20) });
  assert.deepEqual([p.legacy, p.billable, p.amount], [false, 9, 289_286]);
});
