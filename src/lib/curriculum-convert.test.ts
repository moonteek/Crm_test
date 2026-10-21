import { test } from "node:test";
import assert from "node:assert/strict";
import { planConversion, structureProblem, type LineShape } from "./curriculum-convert";

test("conversion: one section per course, months become levels, groups linked", () => {
  const plan = planConversion({
    courses: [{ id: 1, name: "Web dasturlash", sections: [] }, { id: 2, name: "SMM", sections: [] }],
    subjects: [
      { id: 10, courseId: 1, sectionId: null, months: 3, levels: 1 },
      { id: 11, courseId: 2, sectionId: null, months: 1, levels: 1 },
    ],
    groups: [{ id: 100, courseId: 1, sectionId: null }, { id: 101, courseId: 2, sectionId: null }],
  });
  assert.deepEqual(plan.newSections, [{ courseId: 1, name: "Web dasturlash" }, { courseId: 2, name: "SMM" }]);
  assert.deepEqual(plan.subjects, [{ id: 10, courseId: 1, levels: 3 }, { id: 11, courseId: 2, levels: 1 }]);
  assert.deepEqual(plan.groups, [{ id: 100, courseId: 1 }, { id: 101, courseId: 2 }]);
});

test("conversion is idempotent", () => {
  const plan = planConversion({
    courses: [{ id: 1, name: "Web dasturlash", sections: [{ id: 5 }] }],
    subjects: [{ id: 10, courseId: 1, sectionId: 5, months: 3, levels: 3 }],
    groups: [{ id: 100, courseId: 1, sectionId: 5 }],
  });
  assert.deepEqual(plan, { newSections: [], subjects: [], groups: [] });
});

const shape = (...xs: [number, number, number][]): LineShape[] => xs.map(([id, position, levels]) => ({ id, position, levels }));
const before = shape([1, 1, 1], [2, 2, 1], [3, 3, 3]);

test("structure guard: a section without scored exams changes freely", () => {
  assert.equal(structureProblem(before, shape([2, 1, 1], [1, 2, 1], [3, 3, 3]), false), null);
  assert.equal(structureProblem(before, shape([1, 1, 1], [3, 3, 3]), false), null);
});

test("structure guard with a scored exam", () => {
  const refused = (after: LineShape[]) => assert.match(String(structureProblem(before, after, true)), /baholangan/);
  refused(shape([2, 1, 1], [1, 2, 1], [3, 3, 3])); // reorder
  refused(shape([1, 1, 1], [3, 3, 3])); // remove (also: moved to another section)
  refused(shape([1, 1, 1], [2, 2, 1], [3, 3, 2])); // levels changed
  refused(shape([9, 0, 1], [1, 1, 1], [2, 2, 1], [3, 3, 3])); // new line before existing ones
  assert.equal(structureProblem(before, shape([1, 1, 1], [2, 2, 1], [3, 3, 3], [9, 4, 2]), true), null); // appended at the end
  assert.equal(structureProblem(before, before, true), null); // names / lessons changed only
});

test("structure guard: moving a line to another section counts as removing it here", () => {
  assert.match(String(structureProblem(before, shape([1, 1, 1], [2, 2, 1]), true)), /baholangan/); // line 3 moved away
});
