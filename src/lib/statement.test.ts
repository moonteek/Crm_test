import { test } from "node:test";
import assert from "node:assert/strict";
import { balance } from "./billing";
import { statement, type StatementMembership } from "./statement";

const nov = (day: number) => new Date(Date.UTC(2026, 10, day));
const NOW = nov(15);

const member = (events: StatementMembership["events"]): StatementMembership => ({
  groupId: 1, group: { name: "ROBO-3", days: "EVEN", course: { price: 600_000 } }, events,
});
const pay = (id: number, amount: number, date: Date) => ({ id, amount, method: "CASH", date, note: null, groupId: 1 });

test("newest first, with a running balance that ends at the student's balance", () => {
  const ms = [member([{ type: "ACTIVATE", date: nov(1) }])];
  const payments = [pay(1, 600_000, nov(5))];
  const rows = statement(ms, payments, NOW);
  assert.deepEqual(rows.map((r) => [r.kind, r.amount, r.balance]), [
    ["payment", 600_000, 0],
    ["charge", -600_000, -600_000],
    ["event", 0, 0],
  ]);
  assert.equal(rows[0].balance, balance(ms, payments, NOW));
});

test("charges are dated the 1st of their month and say how many lessons", () => {
  const rows = statement([member([{ type: "ACTIVATE", date: nov(12) }])], [], NOW);
  const charge = rows.find((r) => r.kind === "charge")!;
  assert.deepEqual(charge.date, nov(1));
  assert.equal(charge.lessons, "8/12 dars");
  assert.equal(charge.groupName, "ROBO-3");
  assert.equal(charge.amount, -400_000);
});

test("a freeze shows its reason and costs nothing by itself", () => {
  const rows = statement([member([
    { type: "ACTIVATE", date: nov(1) },
    { type: "FREEZE", date: nov(10), reason: { name: "Kasallik" }, comment: "shifoxonada" },
  ])], [], NOW);
  const freeze = rows.find((r) => r.kind === "event" && r.label.startsWith("Muzlatildi"))!;
  assert.equal(freeze.amount, 0);
  assert.equal(freeze.label, "Muzlatildi · Kasallik · shifoxonada");
});

test("months before the switch are labelled as full months", () => {
  const rows = statement([member([{ type: "ACTIVATE", date: new Date(Date.UTC(2026, 9, 1)) }])], [], NOW);
  assert.deepEqual(rows.filter((r) => r.kind === "charge").map((r) => r.lessons), ["12/12 dars", "to'liq oy"]);
});
