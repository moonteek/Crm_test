import { test } from "node:test";
import assert from "node:assert/strict";
import { studentHistory } from "./student-history";

const at = (s: string) => new Date(s);

test("history merges events, payments and logs newest first; skips logs the tables already show", () => {
  const items = studentHistory({
    events: [
      { date: at("2026-09-01"), createdAt: at("2026-09-01T10:00:00Z"), type: "TRIAL", group: "FE-14", user: "Direktor", reason: null },
      { date: at("2026-09-10"), createdAt: at("2026-09-10T10:00:00Z"), type: "FREEZE", group: "FE-14", user: "Direktor", reason: "Kasal" },
    ],
    payments: [{ date: at("2026-09-05T08:00:00Z"), amount: 600000, group: "FE-14", method: "CASH" }],
    logs: [
      { createdAt: at("2026-09-05T08:00:01Z"), action: "payment.create", summary: "To'lov: …", user: "Kassir" },
      { createdAt: at("2026-09-01T10:00:01Z"), action: "student.join", summary: "Ali → FE-14", user: "Direktor" },
      { createdAt: at("2026-09-12T09:00:00Z"), action: "student.note", summary: "Eslatma qo'shildi", user: "Menejer" },
      { createdAt: at("2026-09-11T09:00:00Z"), action: "payment.delete", summary: "To'lov o'chirildi: Ali — 100 000 so'm", user: "Kassir" },
    ],
  });
  assert.deepEqual(items.map((i) => [i.what, i.group, i.amount, i.who]), [
    ["Eslatma qo'shildi", null, null, "Menejer"],
    ["To'lov o'chirildi: Ali — 100 000 so'm", null, null, "Kassir"],
    ["Muzlatildi · Kasal", "FE-14", null, "Direktor"],
    ["To'lov · Naqd", "FE-14", 600000, null],
    ["Sinov darsiga qo'shildi", "FE-14", null, "Direktor"],
  ]);
});

test("without payment access the history has no payments and no payment logs", () => {
  const items = studentHistory({
    events: [],
    payments: [{ date: at("2026-09-05T08:00:00Z"), amount: 600000, group: "FE-14", method: "CASH" }],
    logs: [
      { createdAt: at("2026-09-11T09:00:00Z"), action: "payment.delete", summary: "To'lov o'chirildi: Ali — 100 000 so'm", user: "Kassir" },
      { createdAt: at("2026-09-12T09:00:00Z"), action: "student.note", summary: "Eslatma qo'shildi", user: "Menejer" },
    ],
  }, { showMoney: false });
  assert.deepEqual(items.map((i) => i.what), ["Eslatma qo'shildi"]);
});
