import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTeacherChange, teacherOn } from "./teachers-history";

const nov = (day: number) => new Date(Date.UTC(2026, 10, day));
const EPOCH = new Date(0);
const current = { teacherId: 2, assistantId: 9 };

test("no history: the current teacher and assistant taught every lesson", () => {
  assert.equal(teacherOn([], current, nov(5), "TEACHER"), 2);
  assert.equal(teacherOn([], current, nov(5), "ASSISTANT"), 9);
});

test("a change from the 20th: lessons before belong to the old teacher, from the 20th to the new", () => {
  const h = [{ userId: 1, role: "TEACHER", from: EPOCH }, { userId: 2, role: "TEACHER", from: nov(20) }];
  assert.equal(teacherOn(h, current, nov(19), "TEACHER"), 1);
  assert.equal(teacherOn(h, current, nov(20), "TEACHER"), 2);
});

test("assistant history is separate from the teacher's", () => {
  const h = [{ userId: 1, role: "TEACHER", from: EPOCH }, { userId: 2, role: "TEACHER", from: nov(20) }];
  assert.equal(teacherOn(h, current, nov(25), "ASSISTANT"), 9);
});

test("a group without a teacher for a period", () => {
  const h = [{ userId: 1, role: "TEACHER", from: EPOCH }, { userId: null, role: "TEACHER", from: nov(10) }];
  assert.equal(teacherOn(h, { teacherId: null, assistantId: null }, nov(12), "TEACHER"), null);
});

test("a change dated before the latest change of that role is refused; the same day is allowed", () => {
  const h = [{ userId: 1, role: "TEACHER", from: EPOCH }, { userId: 2, role: "TEACHER", from: nov(20) }];
  assert.equal(checkTeacherChange(h, "TEACHER", nov(15)), "Yangi o'qituvchi sanasi oldingi almashtirishdan (20.11.2026) oldin bo'lishi mumkin emas");
  assert.equal(checkTeacherChange(h, "TEACHER", nov(20)), null);
  assert.equal(checkTeacherChange(h, "ASSISTANT", nov(15)), null);
});
