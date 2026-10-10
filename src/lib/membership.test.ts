import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedActions, applyEvent, menuActions, statusAfter, systemLeaveDate, type EventType } from "./membership";

const day = (n: number) => new Date(Date.UTC(2026, 10, n));
const history = (...types: EventType[]) => types.map((type, i) => ({ type, date: day(i + 1) }));

test("statusAfter follows the last event", () => {
  assert.equal(statusAfter([]), null);
  assert.equal(statusAfter(history("TRIAL")), "TRIAL");
  assert.equal(statusAfter(history("TRIAL", "ACTIVATE", "FREEZE")), "FROZEN");
  assert.equal(statusAfter(history("ACTIVATE", "FREEZE", "UNFREEZE")), "ACTIVE");
  assert.equal(statusAfter(history("ACTIVATE", "BACK_TO_TRIAL")), "TRIAL");
  assert.equal(statusAfter(history("ACTIVATE", "LEAVE")), "LEFT");
});

test("allowed actions per status", () => {
  assert.deepEqual(allowedActions(null), ["TRIAL", "ACTIVATE"]);
  assert.deepEqual(allowedActions("TRIAL"), ["ACTIVATE", "LEAVE"]);
  assert.deepEqual(allowedActions("ACTIVE"), ["FREEZE", "BACK_TO_TRIAL", "LEAVE"]);
  assert.deepEqual(allowedActions("FROZEN"), ["UNFREEZE", "LEAVE"]);
  assert.deepEqual(allowedActions("LEFT"), ["TRIAL", "ACTIVATE"]);
});

test("each allowed step gives the next status", () => {
  assert.deepEqual(applyEvent([], { type: "TRIAL", date: day(1) }), { ok: true, status: "TRIAL" });
  assert.deepEqual(applyEvent(history("TRIAL"), { type: "ACTIVATE", date: day(3) }), { ok: true, status: "ACTIVE" });
  assert.deepEqual(applyEvent(history("ACTIVATE"), { type: "FREEZE", date: day(5), reasonId: 1 }), { ok: true, status: "FROZEN" });
  assert.deepEqual(applyEvent(history("ACTIVATE", "FREEZE"), { type: "UNFREEZE", date: day(5) }), { ok: true, status: "ACTIVE" });
  assert.deepEqual(applyEvent(history("ACTIVATE"), { type: "BACK_TO_TRIAL", date: day(5) }), { ok: true, status: "TRIAL" });
  assert.deepEqual(applyEvent(history("TRIAL"), { type: "LEAVE", date: day(5), reasonId: 1 }), { ok: true, status: "LEFT" });
});

test("steps that make no sense are refused", () => {
  assert.equal(applyEvent(history("ACTIVATE"), { type: "UNFREEZE", date: day(5) }).ok, false);
  assert.equal(applyEvent(history("TRIAL"), { type: "FREEZE", date: day(5), reasonId: 1 }).ok, false);
  assert.equal(applyEvent([], { type: "LEAVE", date: day(5), reasonId: 1 }).ok, false);
});

test("freezing twice (double click, two staff at once) is refused", () => {
  const r = applyEvent(history("ACTIVATE", "FREEZE"), { type: "FREEZE", date: day(5), reasonId: 1 });
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /muzlatilgan/i);
});

test("a date before the previous step is refused; the same day is fine", () => {
  const r = applyEvent(history("ACTIVATE", "FREEZE"), { type: "UNFREEZE", date: day(1) });
  assert.deepEqual(r, { ok: false, error: "Sana oldingi amaldan oldin bo'lishi mumkin emas" });
  assert.equal(applyEvent(history("ACTIVATE", "FREEZE"), { type: "UNFREEZE", date: day(2) }).ok, true);
});

test("freezing and leaving need a reason, unless the system does it (group finished)", () => {
  assert.equal(applyEvent(history("ACTIVATE"), { type: "FREEZE", date: day(5) }).ok, false);
  assert.equal(applyEvent(history("ACTIVATE"), { type: "LEAVE", date: day(5) }).ok, false);
  assert.equal(applyEvent(history("ACTIVATE", "FREEZE"), { type: "LEAVE", date: day(5), system: true }).ok, true);
  assert.equal(applyEvent(history("TRIAL"), { type: "LEAVE", date: day(5), system: true }).ok, true);
});

test("a student who left can join again; history is kept", () => {
  assert.deepEqual(applyEvent(history("ACTIVATE", "LEAVE"), { type: "ACTIVATE", date: day(9) }), { ok: true, status: "ACTIVE" });
  assert.deepEqual(applyEvent(history("ACTIVATE", "LEAVE"), { type: "TRIAL", date: day(9) }), { ok: true, status: "TRIAL" });
});

test("the menu offers activation only to trial students; left members re-join via 'add to group'", () => {
  assert.deepEqual(menuActions("TRIAL"), ["ACTIVATE", "LEAVE"]);
  assert.deepEqual(menuActions("ACTIVE"), ["FREEZE", "BACK_TO_TRIAL", "LEAVE"]);
  assert.deepEqual(menuActions("FROZEN"), ["UNFREEZE", "LEAVE"]);
  assert.deepEqual(menuActions("LEFT"), []);
});

test("finishing a group never dates the leave before a member's last step", () => {
  assert.deepEqual(systemLeaveDate([{ date: day(20) }], day(10)), day(20));
  assert.deepEqual(systemLeaveDate([{ date: day(2) }], day(10)), day(10));
});
