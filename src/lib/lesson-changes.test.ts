import { test } from "node:test";
import assert from "node:assert/strict";
import { closedDays, lessonChangeOpen, lessonChangeProblem, markProblem, whoTaught } from "./lesson-changes";

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

test("marks: only lessons that already happened (today included)", () => {
  const today = new Date("2026-10-12T00:00:00Z");
  assert.equal(markProblem(new Date("2026-10-12T00:00:00Z"), today), null);
  assert.equal(markProblem(new Date("2026-10-10T00:00:00Z"), today), null);
  assert.equal(markProblem(new Date("2026-10-13T00:00:00Z"), today), "Hali bo'lmagan darsni belgilab bo'lmaydi");
});

test("substitute: not the person who had that lesson, nor the group's other teacher on it", () => {
  const today = new Date("2026-11-02T00:00:00Z");
  const base = { kind: "SUBSTITUTE" as const, date: new Date("2026-11-10T00:00:00Z"), days: "EVEN", holidays: [], existing: [] };
  // teacher on that day was 3 (history), the assistant 4; today's teacher (7) doesn't matter
  assert.equal(lessonChangeProblem({ ...base, substituteId: 3, absentId: 3, onLesson: [3, 4] }, today), "O'zini o'zi almashtira olmaydi");
  assert.equal(lessonChangeProblem({ ...base, substituteId: 4, absentId: 3, onLesson: [3, 4] }, today), "Bu darsda u allaqachon bor (guruhning o'qituvchisi)");
  assert.equal(lessonChangeProblem({ ...base, substituteId: 7, absentId: 3, onLesson: [3, 4] }, today), null);
});

test("lesson changes are open from this month on (centre time), for the menus and the server alike", () => {
  const today = new Date("2026-11-02T00:00:00Z");
  assert.equal(lessonChangeOpen(new Date("2026-11-01T00:00:00Z"), today), true);
  assert.equal(lessonChangeOpen(new Date("2026-12-20T00:00:00Z"), today), true);
  assert.equal(lessonChangeOpen(new Date("2026-10-31T00:00:00Z"), today), false);
});
