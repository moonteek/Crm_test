import { test } from "node:test";
import assert from "node:assert/strict";
import { closedDays, lessonChangeProblem, whoTaught } from "./lesson-changes";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));
const today = new Date("2026-11-04T08:00:00Z");
const base = { kind: "CANCEL" as const, date: d(2026, 11, 10), days: "EVEN", holidays: [] as string[], existing: [] as { kind: string; date: Date }[] };

test("lesson change rules", () => {
  assert.equal(lessonChangeProblem(base, today), null);
  assert.equal(lessonChangeProblem({ ...base, date: d(2026, 11, 9) }, today), "Bu kunda dars yo'q");
  assert.equal(lessonChangeProblem({ ...base, holidays: ["2026-11-10"] }, today), "Bayram kuni — dars yo'q");
  assert.equal(lessonChangeProblem({ ...base, date: d(2026, 10, 27) }, today), "Faqat shu oydan boshlab");
  assert.equal(lessonChangeProblem({ ...base, existing: [{ kind: "CANCEL", date: d(2026, 11, 10) }] }, today), "Bu dars allaqachon bekor qilingan");
  assert.equal(lessonChangeProblem({ ...base, kind: "SUBSTITUTE", substituteId: 5, absentId: 3, existing: [{ kind: "CANCEL", date: d(2026, 11, 10) }] }, today), "Bu dars allaqachon bekor qilingan");
  assert.equal(lessonChangeProblem({ ...base, existing: [{ kind: "SUBSTITUTE", date: d(2026, 11, 10) }] }, today), "Bu darsga o'rinbosar biriktirilgan — avval uni bekor qiling");
  assert.equal(lessonChangeProblem({ ...base, kind: "SUBSTITUTE", substituteId: 3, absentId: 3 }, today), "O'zini o'zi almashtira olmaydi");
  assert.equal(lessonChangeProblem({ ...base, kind: "SUBSTITUTE", substituteId: null, absentId: 3 }, today), "O'rinbosarni tanlang");
});

test("closed days: holidays and the group's cancelled lessons, once each", () => {
  assert.deepEqual(closedDays(["2026-11-10", "2026-12-31"], [d(2026, 11, 10), d(2026, 11, 12)]), ["2026-11-10", "2026-12-31", "2026-11-12"]);
});

test("a substitute takes their role's lesson that day only", () => {
  const subs = [{ date: d(2026, 11, 10), role: "TEACHER", substituteId: 9 }];
  assert.equal(whoTaught(d(2026, 11, 10), "TEACHER", 1, subs), 9);
  assert.equal(whoTaught(d(2026, 11, 10), "ASSISTANT", 2, subs), 2);
  assert.equal(whoTaught(d(2026, 11, 12), "TEACHER", 1, subs), 1);
});
