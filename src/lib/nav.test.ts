import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV, phoneTabs, navSections } from "./nav";

const hrefs = (permissions: string[]) => phoneTabs(permissions).map((t) => t.href);
const ALL = [...new Set(NAV.flatMap((n) => [n.perm].flat()))];

test("a teacher gets timetable, groups and students", () => {
  assert.deepEqual(hrefs(["groups.view", "students.view"]), ["/schedule", "/groups", "/students"]);
});

test("an admin gets home, timetable and groups", () => {
  assert.deepEqual(hrefs(ALL), ["/", "/schedule", "/groups"]);
});

test("a cashier with one priority page gets just that page", () => {
  assert.deepEqual(hrefs(["payments.view", "debtors.view"]), ["/payments"]);
});

test("home is never offered without dashboard.view", () => {
  assert.ok(!hrefs(ALL.filter((p) => p !== "dashboard.view")).includes("/"));
});

test("tabs are unique and at most three", () => {
  for (const perms of [ALL, ["groups.view"], [], ["leads.view", "payments.view", "students.view", "groups.view"]]) {
    const tabs = hrefs(perms);
    assert.ok(tabs.length <= 3);
    assert.equal(new Set(tabs).size, tabs.length);
  }
});

test("the menu is grouped; sections with nothing allowed disappear", () => {
  const admin = navSections(["dashboard.view", "analytics.view", "leads.view", "sales.view", "students.view", "groups.view", "teachers.view", "self.teacher", "courses.view", "payments.view", "debtors.view", "shop.view", "finance.view", "salaries.view", "rooms.manage", "audit.view", "staff.manage"]);
  assert.deepEqual(admin.map((s) => [s.title, s.items.length]), [[null, 2], ["O'quv", 7], ["Sotuv", 2], ["Moliya", 5], ["Tizim", 2]]);
  const teacher = navSections(["groups.view", "students.view", "attendance.mark", "self.teacher"]);
  assert.deepEqual(teacher.map((s) => [s.title, s.items.map((i) => i.href)]), [["O'quv", ["/students", "/groups", "/schedule", "/availability"]]]);
});
