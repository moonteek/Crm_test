import { test } from "node:test";
import assert from "node:assert/strict";
import { daysLabel, endOf, lessonMinutes, normalizeDays, timeProblem, weekdaysOf } from "./group-days";

test("group days: named and custom sets give their weekdays", () => {
  assert.deepEqual(weekdaysOf("ODD"), [1, 3, 5]);
  assert.deepEqual(weekdaysOf("EVEN"), [2, 4, 6]);
  assert.deepEqual(weekdaysOf("DAILY"), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(weekdaysOf("1,4,6"), [1, 4, 6]);
  assert.deepEqual(weekdaysOf("nonsense"), []);
});

test("group days: a custom set is sorted, deduplicated and stored as a name when it equals one", () => {
  assert.equal(normalizeDays([5, 1, 3, 3]), "ODD");
  assert.equal(normalizeDays([2, 4, 6]), "EVEN");
  assert.equal(normalizeDays([1, 2, 3, 4, 5, 6]), "DAILY");
  assert.equal(normalizeDays([6, 1, 4]), "1,4,6");
});

test("group days: no day, Sunday or a non-weekday is refused", () => {
  assert.equal(normalizeDays([]), null);
  assert.equal(normalizeDays([0, 1]), null);
  assert.equal(normalizeDays([7]), null);
  assert.equal(normalizeDays([1.5]), null);
});

test("group days: labels", () => {
  assert.equal(daysLabel("1,4,6"), "Du / Pay / Sha");
  assert.equal(daysLabel("ODD"), "Du / Chor / Ju");
  assert.equal(daysLabel("DAILY"), "Har kuni");
});

test("lesson length: the end time, else the course length", () => {
  assert.equal(lessonMinutes({ time: "14:00", endTime: null, course: { lessonMin: 90 } }), 90);
  assert.equal(lessonMinutes({ time: "14:00", endTime: "15:30", course: { lessonMin: 120 } }), 90);
  assert.equal(endOf({ time: "14:00", endTime: null, course: { lessonMin: 120 } }), "16:00");
  assert.equal(endOf({ time: "09:30", endTime: "11:00", course: { lessonMin: 120 } }), "11:00");
});

test("lesson time rules", () => {
  assert.equal(timeProblem("14:00", "14:00"), "Tugash vaqti boshlanishdan keyin bo'lishi kerak");
  assert.equal(timeProblem("15:00", "14:00"), "Tugash vaqti boshlanishdan keyin bo'lishi kerak");
  assert.equal(timeProblem("10:00", "14:30"), "Dars 4 soatdan uzun bo'lmasin");
  assert.equal(timeProblem("19:00", "20:30"), "Dars 08:00–20:00 oralig'ida bo'lishi kerak");
  assert.equal(timeProblem("07:30", "09:00"), "Dars 08:00–20:00 oralig'ida bo'lishi kerak");
  assert.equal(timeProblem("14:00", "16:00"), null);
  assert.equal(timeProblem("10:00", "14:00"), null);
});
