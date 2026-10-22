import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStudentFilters, studentWhere } from "./student-filters";

test("defaults and clamps", () => {
  const f = parseStudentFilters({}, { canSeeBalances: true });
  assert.deepEqual(f, { q: "", groupId: null, courseId: null, teacherId: null, tagId: null, status: "active", page: 1, per: 20 });
  const g = parseStudentFilters({ per: "999", page: "0", group: "abc", status: "nonsense", q: "  ali " }, { canSeeBalances: true });
  assert.deepEqual([g.per, g.page, g.groupId, g.status, g.q], [20, 1, null, "active", "ali"]);
  assert.equal(parseStudentFilters({ per: "50", page: "3" }, { canSeeBalances: true }).per, 50);
});

test("the debtor filter is ignored for roles that can't see balances", () => {
  assert.equal(parseStudentFilters({ status: "debtor" }, { canSeeBalances: true }).status, "debtor");
  assert.equal(parseStudentFilters({ status: "debtor" }, { canSeeBalances: false }).status, "all");
});

test("where: search covers every phone, teacher means teacher or assistant, scope always applies", () => {
  const scope = { id: { in: [1, 2] } };
  const w = studentWhere(parseStudentFilters({ q: "90", teacher: "8", status: "frozen" }, { canSeeBalances: true }), scope);
  assert.deepEqual(w, {
    AND: [
      scope,
      { OR: [{ name: { contains: "90" } }, { phone: { contains: "90" } }, { phone2: { contains: "90" } }, { fatherPhone: { contains: "90" } }, { motherPhone: { contains: "90" } }, { fatherName: { contains: "90" } }, { motherName: { contains: "90" } }] },
      { groups: { some: { leftAt: null, group: { OR: [{ teacherId: 8 }, { assistantId: 8 }] }, status: "FROZEN" } } },
    ],
  });
  const none = studentWhere(parseStudentFilters({ status: "none", group: "3", course: "1", tag: "2" }, { canSeeBalances: true }), {});
  assert.deepEqual(none, {
    AND: [
      {},
      { groups: { some: { leftAt: null, groupId: 3 } } },
      { groups: { some: { leftAt: null, group: { courseId: 1 } } } },
      { tags: { some: { tagId: 2 } } },
      { groups: { none: { leftAt: null } } },
    ],
  });
});

test("a status with a group, course or teacher applies to that same membership", () => {
  const w = studentWhere(parseStudentFilters({ group: "5", status: "trial" }, { canSeeBalances: true }), {});
  assert.deepEqual(w, { AND: [{}, { groups: { some: { leftAt: null, groupId: 5, status: "TRIAL" } } }] });
  const t = studentWhere(parseStudentFilters({ teacher: "8", course: "1", status: "frozen" }, { canSeeBalances: true }), {});
  assert.deepEqual(t, { AND: [{}, { groups: { some: { leftAt: null, group: { courseId: 1 }, status: "FROZEN" } } }, { groups: { some: { leftAt: null, group: { OR: [{ teacherId: 8 }, { assistantId: 8 }] }, status: "FROZEN" } } }] });
});
