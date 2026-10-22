import { test } from "node:test";
import assert from "node:assert/strict";
import { balance } from "./billing";
import { statement, type StatementMembership } from "./statement";

const nov = (day: number) => new Date(Date.UTC(2026, 10, day));
const NOW = nov(15);

const member = (events: StatementMembership["events"]): StatementMembership => ({
  groupId: 1, group: { name: "ROBO-3", days: "EVEN", course: { price: 600_000 } }, events, holidays: [],
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
  const freeze = rows.find((r) => r.kind === "event" && r.type === "Muzlatildi")!;
  assert.equal(freeze.amount, 0);
  assert.equal(freeze.label, "Kasallik · shifoxonada");
});

test("months before the switch are labelled as full months", () => {
  const rows = statement([member([{ type: "ACTIVATE", date: new Date(Date.UTC(2026, 9, 1)) }])], [], NOW);
  assert.deepEqual(rows.filter((r) => r.kind === "charge").map((r) => r.lessons), ["12/12 dars", "to'liq oy"]);
});

test("a discounted month says how much was taken off", () => {
  const m = { ...member([{ type: "ACTIVATE", date: nov(1) }]), discounts: [{ from: nov(1), to: nov(1), amount: 200_000 }] };
  const charge = statement([m], [], NOW).find((r) => r.kind === "charge")!;
  assert.equal(charge.amount, -400_000);
  assert.equal(charge.lessons, "12/12 dars · chegirma −200 000 so'm");
});

test("ledger rows say what they are, who recorded them and when; the note sits on its own line", async () => {
  const at = new Date("2026-11-05T09:30:00Z");
  const rows = statement(
    [{ ...member([{ type: "ACTIVATE", date: nov(1), user: { name: "Menejer" }, createdAt: nov(1) }]) }],
    [{ ...pay(1, 600_000, nov(5)), note: "onasi olib keldi", user: { name: "Direktor" }, createdAt: at }],
    NOW,
  );
  const p = rows.find((r) => r.kind === "payment")!;
  assert.deepEqual([p.type, p.label, p.who, p.at, p.note, p.method], ["To'lov", "Naqd", "Direktor", at, "onasi olib keldi", "CASH"]);
  const c = rows.find((r) => r.kind === "charge")!;
  assert.deepEqual([c.type, c.label, c.who, c.at], ["Oylik hisob", "Noyabr 2026", "Tizim", null]);
  const e = rows.find((r) => r.kind === "event")!;
  assert.deepEqual([e.type, e.who], ["Faollashtirildi", "Menejer"]);
});

test("a transfer reads as one: left for another group, joined by transfer", () => {
  const a: StatementMembership = { ...member([{ type: "ACTIVATE", date: nov(1) }, { type: "LEAVE", date: nov(10) }]), groupId: 1 };
  const b: StatementMembership = { ...member([{ type: "ACTIVATE", date: nov(10) }]), groupId: 2, group: { name: "PY-07", days: "ODD", course: { price: 650_000 } } };
  const types = statement([a, b], [], NOW).filter((r) => r.kind === "event").map((r) => [r.groupName, r.type]);
  assert.deepEqual(types, [["PY-07", "O'tkazma bilan qo'shildi"], ["ROBO-3", "Boshqa guruhga o'tkazildi"], ["ROBO-3", "Faollashtirildi"]]);
});

test("the ledger filter keeps each row's own running balance", async () => {
  const { filterLedger } = await import("./statement");
  const rows = statement(
    [member([{ type: "ACTIVATE", date: nov(1) }])],
    [pay(1, 300_000, nov(5)), { ...pay(2, 300_000, nov(6)), method: "CARD" }],
    NOW,
  );
  const cash = filterLedger(rows, "CASH");
  assert.deepEqual(cash.map((r) => [r.paymentId, r.balance]), [[1, rows.find((r) => r.paymentId === 1)!.balance]]);
  assert.deepEqual(filterLedger(rows, "payments").map((r) => r.paymentId), [2, 1]);
  assert.deepEqual(filterLedger(rows, "charges").map((r) => r.kind), ["charge"]);
  assert.deepEqual(filterLedger(rows, "events").map((r) => r.kind), ["event"]);
  assert.equal(filterLedger(rows, "bogus").length, rows.length);
});
