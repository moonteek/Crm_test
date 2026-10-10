import { test } from "node:test";
import assert from "node:assert/strict";
import { lessonValues } from "./billing";
import { teacherEarnings, type PayMembership } from "./teacher-pay";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));
const oct = (day: number) => d(2026, 10, day);
const nov = (day: number) => d(2026, 11, day);
const NOW = d(2026, 11, 28);
const EPOCH = new Date(0);
const A = 1, B = 2, ASSIST = 9;

let nextStudent = 100;
function member(
  group: { id: number; name: string; days: string; price: number; teacherId: number | null; assistantId?: number | null; teachers?: PayMembership["group"]["teachers"] },
  ...events: [string, Date, boolean?][]
): PayMembership {
  return {
    groupId: group.id,
    student: { id: nextStudent, name: `S${nextStudent++}` },
    group: { ...group, assistantId: group.assistantId ?? null, course: { price: group.price } },
    events: events.map(([type, date, migrated]) => ({ type, date, migrated: migrated ?? false })),
  };
}
const ROBO = { id: 6, name: "ROBO-3", days: "EVEN", price: 450_000, teacherId: A };
const FE = { id: 2, name: "FE-14", days: "ODD", price: 600_000, teacherId: B };
const sum = (xs: { value: number }[]) => xs.reduce((s, x) => s + x.value, 0);

test("lesson values add up exactly to the month charge", () => {
  const full = member({ ...FE }, ["ACTIVATE", nov(1)]);
  assert.equal(sum(lessonValues(full, 2026, 10, NOW)), 600_000);
  assert.equal(lessonValues(full, 2026, 10, NOW).length, 13);
  const part = member({ ...FE }, ["ACTIVATE", nov(1)], ["FREEZE", nov(20)]);
  assert.equal(sum(lessonValues(part, 2026, 10, NOW)), Math.round((600_000 * 9) / 13));
});

test("transfer on 20 Oct: the old and new teacher each earn on their own lessons (40%)", () => {
  const old = member(ROBO, ["ACTIVATE", d(2026, 9, 1), true], ["LEAVE", oct(20)]);
  const next = { ...member(FE, ["ACTIVATE", oct(20)]), student: old.student };
  const pct = { type: "PERCENT" as const, amount: 40 };
  const a = teacherEarnings(A, pct, [old, next], 2026, 9, NOW);
  const b = teacherEarnings(B, pct, [old, next], 2026, 9, NOW);
  assert.deepEqual(a.rows.map((r) => [r.groupName, r.lessons, r.value]), [["ROBO-3", 9, 289_286]]);
  assert.deepEqual(b.rows.map((r) => [r.groupName, r.lessons, r.value]), [["FE-14", 5, 230_769]]);
  assert.equal(a.total, 115_714);
  assert.equal(b.total, 92_308);
});

test("a new teacher from 17 Nov in the same group: lessons split by day", () => {
  const g = { id: 7, name: "G", days: "EVEN", price: 600_000, teacherId: B, teachers: [
    { userId: A, role: "TEACHER", from: EPOCH }, { userId: B, role: "TEACHER", from: nov(17) },
  ] };
  const m = member(g, ["ACTIVATE", nov(1)]);
  const pct = { type: "PERCENT" as const, amount: 40 };
  assert.deepEqual([teacherEarnings(A, pct, [m], 2026, 10, NOW).total, teacherEarnings(B, pct, [m], 2026, 10, NOW).total], [120_000, 120_000]);
});

test("frozen and trial lessons earn nothing", () => {
  const frozen = member({ ...ROBO, days: "EVEN", price: 600_000 }, ["ACTIVATE", nov(1)], ["FREEZE", nov(10)]);
  const trial = member({ ...ROBO, price: 600_000 }, ["TRIAL", nov(3)]);
  const r = teacherEarnings(A, { type: "PERCENT", amount: 40 }, [frozen, trial], 2026, 10, NOW);
  assert.deepEqual(r.rows.map((x) => [x.lessons, x.value]), [[4, 200_000]]);
  assert.equal(r.total, 80_000);
});

test("an assistant earns on the same lessons", () => {
  const m = member({ ...ROBO, price: 600_000, assistantId: ASSIST }, ["ACTIVATE", nov(1)]);
  assert.equal(teacherEarnings(ASSIST, { type: "PERCENT", amount: 10 }, [m], 2026, 10, NOW).total, 60_000);
});

test("per-student pay follows the share of the month's lessons", () => {
  const half = member({ ...ROBO, price: 600_000 }, ["ACTIVATE", nov(1)], ["LEAVE", nov(14)]);
  const full = member({ ...ROBO, price: 600_000 }, ["ACTIVATE", nov(1)]);
  const r = teacherEarnings(A, { type: "PER_STUDENT", amount: 500_000 }, [half, full], 2026, 10, NOW);
  assert.deepEqual(r.rows.map((x) => [x.lessons, x.lessonsInMonth, x.share]), [[6, 12, 250_000], [12, 12, 500_000]]);
  assert.equal(r.total, 750_000);
});

test("another teacher's students are not counted", () => {
  const m = member(FE, ["ACTIVATE", nov(1)]);
  assert.deepEqual(teacherEarnings(A, { type: "PERCENT", amount: 40 }, [m], 2026, 10, NOW), { rows: [], total: 0 });
});
