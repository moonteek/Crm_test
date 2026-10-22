import { test } from "node:test";
import assert from "node:assert/strict";
import { busyMarkMessages, busyMarkWarnings, needsClashCheck, clashMessage, dayTypesOf, fitsDay, groupClashes, lessonCells, lessonsFrom, teacherGrid, type LessonLike } from "./availability";

const L = (o: Partial<LessonLike>): LessonLike => ({ id: 1, name: "FE-14", days: "ODD", time: "14:00", minutes: 120, teacherId: 1, assistantId: null, roomId: 1, ...o });
const names = { users: new Map([[1, "Aziz Karimov"], [2, "Shoxrux Aliyev"]]), rooms: new Map([[1, "Kompyuter xonasi"], [2, "1-xona"]]) };

test("lesson cells: hours a lesson touches", () => {
  assert.deepEqual(lessonCells("09:00", 120), [9, 10]);
  assert.deepEqual(lessonCells("14:00", 90), [14, 15]);
  assert.deepEqual(lessonCells("14:30", 90), [14, 15]);
  assert.deepEqual(lessonCells("18:30", 120), [18, 19, 20]);
});

test("lessons must fit 08:00–20:00", () => {
  assert.equal(fitsDay("18:00", 120), true);
  assert.equal(fitsDay("18:30", 120), false);
  assert.equal(fitsDay("07:30", 90), false);
});

test("day types", () => {
  assert.deepEqual(dayTypesOf("ODD"), ["ODD"]);
  assert.deepEqual(dayTypesOf("EVEN"), ["EVEN"]);
  assert.deepEqual(dayTypesOf("DAILY"), ["ODD", "EVEN"]);
  // a custom set marks each day type that contains one of its days
  assert.deepEqual(dayTypesOf("1,4"), ["ODD", "EVEN"]);
  assert.deepEqual(dayTypesOf("1,5"), ["ODD"]);
  assert.deepEqual(dayTypesOf("2,6"), ["EVEN"]);
});

test("clashes: teacher, assistant, room, day types, self, back-to-back", () => {
  const cand = L({ id: 9, name: "NEW", time: "15:00", minutes: 90, roomId: 2 });
  assert.deepEqual(groupClashes(cand, [L({})], names).map((c) => [c.kind, c.who]), [["teacher", "Aziz Karimov"]]);
  assert.deepEqual(groupClashes(cand, [L({ days: "EVEN" })], names), []);
  assert.equal(groupClashes({ ...cand, days: "DAILY" }, [L({})], names).length, 1);
  assert.deepEqual(groupClashes(cand, [L({ teacherId: 2, assistantId: 1 })], names).map((c) => c.who), ["Aziz Karimov"]);
  const room = groupClashes({ ...cand, teacherId: 2, roomId: 1 }, [L({})], names);
  assert.deepEqual(room.map((c) => c.kind), ["room"]);
  assert.equal(clashMessage(room[0]), "Kompyuter xonasi Du / Chor / Ju 14:00–16:00 da FE-14 guruhi bilan band");
  assert.equal(clashMessage(groupClashes(cand, [L({})], names)[0]), "Aziz Karimov Du / Chor / Ju 14:00–16:00 da FE-14 guruhida dars beradi");
  assert.deepEqual(groupClashes(L({ time: "15:00" }), [L({})], names), []); // same id = itself
  assert.deepEqual(groupClashes({ ...cand, teacherId: null, roomId: null }, [L({})], names), []);
  assert.deepEqual(groupClashes({ ...cand, time: "16:00" }, [L({})], names), []);
});

test("teacher grid: lessons win over marks, DAILY fills both day types", () => {
  const g = teacherGrid(1, [L({})], [{ dayType: "ODD", hour: 14, free: true }, { dayType: "ODD", hour: 8, free: false }]);
  assert.deepEqual(g.ODD.get(14), { state: "lesson", group: "FE-14" });
  assert.deepEqual(g.ODD.get(8), { state: "busy" });
  assert.deepEqual(g.ODD.get(9), { state: "unset" });
  assert.deepEqual(g.EVEN.get(14), { state: "unset" });
  const d = teacherGrid(2, [L({ days: "DAILY", teacherId: 3, assistantId: 2 })], []);
  assert.equal(d.ODD.get(15)?.state, "lesson");
  assert.equal(d.EVEN.get(15)?.state, "lesson");
});

test("busy-mark warnings", () => {
  const cand = L({ id: 9 });
  assert.deepEqual(busyMarkWarnings(cand, [{ userId: 1, dayType: "ODD", hour: 15, free: false }]), [{ userId: 1, hours: [15] }]);
  assert.deepEqual(busyMarkWarnings(cand, [{ userId: 1, dayType: "ODD", hour: 15, free: true }]), []);
  assert.deepEqual(busyMarkWarnings(cand, [{ userId: 1, dayType: "EVEN", hour: 15, free: false }]), []);
});

test("edits are checked only when the lesson's when/who/where changes", () => {
  const g = { days: "ODD", time: "14:00", teacherId: 1, assistantId: null, roomId: 1, courseId: 1 };
  assert.equal(needsClashCheck(g, { ...g }), false);
  assert.equal(needsClashCheck(g, { ...g, time: "15:00" }), true);
  assert.equal(needsClashCheck(g, { ...g, courseId: 2 }), true);
  assert.equal(needsClashCheck(g, { ...g, assistantId: 2 }), true);
});

test("busy-mark warning text merges consecutive hours", () => {
  const slots = [14, 15, 18].map((hour) => ({ userId: 1, dayType: "ODD", hour, free: false }));
  assert.deepEqual(busyMarkMessages(L({ id: 9, time: "14:00", minutes: 300 }), slots, names.users), ["Diqqat: Aziz Karimov 14:00–16:00, 18:00–19:00 ni band deb belgilagan"]);
  assert.deepEqual(busyMarkMessages(L({ id: 9 }), [], names.users), []);
});

test("clashes: another group's change still to come counts, at its own time and length", () => {
  const u = (s: string) => new Date(`${s}T00:00:00Z`);
  const other = {
    id: 2, name: "PY-07", days: "EVEN", time: "16:00", endTime: "18:00", teacherId: 2, assistantId: null, roomId: 1, course: { lessonMin: 120 },
    schedules: [{ from: u("2026-09-01"), days: "ODD", time: "14:00", endTime: null }, { from: u("2026-12-01"), days: "EVEN", time: "16:00", endTime: "18:00" }],
  };
  // before the change both schedules lie ahead; from 1 Dec only the new one
  assert.deepEqual(lessonsFrom(other, u("2026-11-20")).map((l) => `${l.days} ${l.time} ${l.minutes}`), ["ODD 14:00 120", "EVEN 16:00 120"]);
  assert.deepEqual(lessonsFrom(other, u("2026-12-05")).map((l) => `${l.days} ${l.time} ${l.minutes}`), ["EVEN 16:00 120"]);
  const candidate = L({ id: 1, days: "EVEN", time: "16:30", minutes: 90, teacherId: 1, roomId: 1 });
  const clashes = groupClashes(candidate, lessonsFrom(other, u("2026-11-20")), names);
  assert.deepEqual(clashes.map((c) => c.kind), ["room"]);
});
