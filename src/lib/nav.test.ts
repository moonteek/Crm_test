import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV, phoneTabs } from "./nav";

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
