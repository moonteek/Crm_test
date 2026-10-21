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

test("day sets: plain cancel, charged cancel, moved lesson", async () => {
  const { unchargedDays, makeupDays } = await import("./lesson-changes");
  const cancels = [
    { date: d(2026, 11, 12), charged: false, makeupDate: null },
    { date: d(2026, 11, 14), charged: true, makeupDate: null },
    { date: d(2026, 11, 17), charged: false, makeupDate: d(2026, 11, 21) },
  ];
  const holidays = ["2026-11-10"];
  assert.deepEqual(closedDays(holidays, cancels.map((c) => c.date)).sort(), ["2026-11-10", "2026-11-12", "2026-11-14", "2026-11-17"]);
  assert.deepEqual(unchargedDays(holidays, cancels).sort(), ["2026-11-10", "2026-11-12"]);
  assert.deepEqual(makeupDays(cancels), ["2026-11-21"]);
});

test("make-up date rules", async () => {
  const { makeupProblem } = await import("./lesson-changes");
  const p = { original: d(2026, 11, 16), today: d(2026, 11, 16), days: "ODD", holidays: ["2026-11-28"], noLesson: ["2026-11-24"] };
  assert.equal(makeupProblem({ ...p, date: d(2026, 11, 21) }), null);
  assert.equal(makeupProblem({ ...p, date: d(2026, 11, 18) }), "Guruhning shu kuni darsi bor");
  assert.equal(makeupProblem({ ...p, date: d(2026, 11, 28) }), "Bayram kuni");
  assert.equal(makeupProblem({ ...p, date: d(2026, 11, 24) }), "Bu kun ham bekor qilingan");
  assert.equal(makeupProblem({ ...p, date: d(2026, 11, 15) }), "Sana bugundan 60 kungacha bo'lishi kerak");
  assert.equal(makeupProblem({ ...p, date: d(2027, 1, 16) }), "Sana bugundan 60 kungacha bo'lishi kerak");
  assert.equal(makeupProblem({ ...p, date: d(2027, 1, 14) }), null); // 59 days ahead, a Thursday
});

test("date clash: teacher (or as assistant) and room", async () => {
  const { clashesOn } = await import("./lesson-changes");
  const cand = { start: "14:00", minutes: 120, teacherId: 5, roomId: 2 };
  const other = (o: object) => ({ name: "PY-07", start: "15:00", minutes: 120, teacherId: null, assistantId: null, roomId: null, ...o });
  assert.deepEqual(clashesOn(cand, [other({ teacherId: 5 })]), ["O'qituvchi band: PY-07 15:00–17:00"]);
  assert.deepEqual(clashesOn(cand, [other({ assistantId: 5 })]), ["O'qituvchi band: PY-07 15:00–17:00"]);
  assert.deepEqual(clashesOn(cand, [other({ roomId: 2 })]), ["Xona band: PY-07 15:00–17:00"]);
  assert.deepEqual(clashesOn(cand, [other({ roomId: 2, start: "16:00" })]), []); // ends as the other starts
});

test("a make-up teacher is paid like a substitute only when it isn't the group's teacher", async () => {
  const { makeupSubstitutes } = await import("./lesson-changes");
  const row = (makeupTeacherId: number | null) => ({ groupId: 1, date: d(2026, 11, 16), charged: false, makeupDate: d(2026, 11, 21), makeupTime: "14:00", makeupRoomId: null, makeupTeacherId });
  assert.deepEqual(makeupSubstitutes([row(7), row(5), row(null)], () => 5), [{ groupId: 1, date: d(2026, 11, 16), role: "TEACHER", substituteId: 7 }]);
});

test("cover access: that group, that day, only on the day", async () => {
  const { coverAllowed } = await import("./lesson-changes");
  const subs = [{ groupId: 1, date: d(2026, 11, 21), substituteId: 7 }];
  const makeups = [{ groupId: 1, date: d(2026, 11, 16), charged: false, makeupDate: d(2026, 11, 21), makeupTime: "14:00", makeupRoomId: null, makeupTeacherId: 9 }];
  const ok = (userId: number, groupId: number, day: string, today: string) => coverAllowed({ userId, groupId, day, today, subs, makeups });
  assert.equal(ok(7, 1, "2026-11-21", "2026-11-21"), true);
  assert.equal(ok(7, 1, "2026-11-21", "2026-11-22"), false);
  assert.equal(ok(7, 2, "2026-11-21", "2026-11-21"), false);
  assert.equal(ok(8, 1, "2026-11-21", "2026-11-21"), false);
  assert.equal(ok(9, 1, "2026-11-21", "2026-11-21"), true);
  assert.equal(ok(9, 1, "2026-11-16", "2026-11-16"), false); // the original day isn't theirs
});

test("a make-up with marks or grades can't be undone or moved", async () => {
  const { makeupLocked } = await import("./lesson-changes");
  assert.equal(makeupLocked(0, 0), null);
  assert.equal(makeupLocked(1, 0), "Qo'shimcha darsda davomat bor — avval uni o'chiring");
  assert.equal(makeupLocked(0, 2), "Qo'shimcha darsda davomat bor — avval uni o'chiring");
});
