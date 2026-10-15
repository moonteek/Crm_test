import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "./format";
import { logoProblem, parseReceiptSettings, RECEIPT_DEFAULTS, receiptText, SAMPLE_RECEIPT, type ReceiptData } from "./receipt";

const data: ReceiptData = {
  id: 1234, date: new Date("2026-10-12T00:00:00Z"), recordedAt: new Date("2026-10-12T03:54:00Z"),
  student: "Azamjon Qo'chqorov", teacher: "Odilov Azizbek", taker: "Karimov Muhammad Ali", group: "A100",
  month: new Date("2026-10-01T00:00:00Z"), method: "CARD", amount: 200_000,
};
const labels = (rows: [string, string][]) => rows.map(([l]) => l).filter(Boolean);
const value = (rows: [string, string][], label: string) => rows.find(([l]) => l === label)?.[1];

test("settings: defaults when nothing is stored or it is broken", () => {
  assert.deepEqual(parseReceiptSettings(null), RECEIPT_DEFAULTS);
  assert.deepEqual(parseReceiptSettings("{broken"), RECEIPT_DEFAULTS);
  assert.equal(RECEIPT_DEFAULTS.name, "Algoritm");
  assert.equal(RECEIPT_DEFAULTS.paper, 80);
  assert.equal(RECEIPT_DEFAULTS.showLogo, true);
  assert.ok(Object.values(RECEIPT_DEFAULTS.lines).every(Boolean));
});

test("settings: a partial or old value keeps what it has, the rest falls back field by field", () => {
  const s = parseReceiptSettings(JSON.stringify({ name: "Oxford", paper: 58, lines: { teacher: false } }));
  assert.equal(s.name, "Oxford");
  assert.equal(s.paper, 58);
  assert.equal(s.lines.teacher, false);
  assert.equal(s.lines.student, true);
  assert.equal(s.phone, "");
  assert.equal(parseReceiptSettings(JSON.stringify({ paper: 70, name: 5 })).paper, 80);
  assert.equal(parseReceiptSettings(JSON.stringify({ paper: 70, name: 5 })).name, "Algoritm");
});

test("receipt: every line in order, values in words, total and footer", () => {
  const r = receiptText(RECEIPT_DEFAULTS, data);
  assert.deepEqual(labels(r.rows), ["Chek №", "Vaqt", "O'quvchi", "O'qituvchi", "Mas'ul", "Guruh", "Qaysi oy uchun", "To'lov turi"]);
  assert.equal(value(r.rows, "Chek №"), "1234");
  assert.equal(value(r.rows, "Vaqt"), "12.10.2026 08:54"); // centre time (UTC+5)
  assert.equal(value(r.rows, "Qaysi oy uchun"), "Oktabr 2026");
  assert.equal(value(r.rows, "To'lov turi"), "Karta");
  assert.deepEqual(r.total, ["Jami:", money(200_000)]);
  assert.equal(r.footer, "Rahmat!");
  assert.deepEqual(r.header, ["Algoritm"]);
});

test("receipt: hidden lines are left out; the total can't be hidden; contacts in the header", () => {
  const s = { ...RECEIPT_DEFAULTS, phone: "+998 90 123 45 67", address: "Toshkent", lines: { ...RECEIPT_DEFAULTS.lines, teacher: false, number: false } };
  const r = receiptText(s, data);
  assert.ok(!labels(r.rows).includes("O'qituvchi"));
  assert.ok(!labels(r.rows).includes("Chek №"));
  assert.deepEqual(r.total, ["Jami:", money(200_000)]);
  assert.deepEqual(r.header, ["Algoritm", "+998 90 123 45 67", "Toshkent"]);
});

test("receipt: no month → no month line; no group, teacher or taker → a dash", () => {
  const r = receiptText(RECEIPT_DEFAULTS, { ...data, month: null, group: null, teacher: null, taker: null });
  assert.ok(!labels(r.rows).includes("Qaysi oy uchun"));
  assert.equal(value(r.rows, "Guruh"), "—");
  assert.equal(value(r.rows, "O'qituvchi"), "—");
  assert.equal(value(r.rows, "Mas'ul"), "—");
});

test("receipt: characters per line by paper; long values wrap and never overflow", () => {
  assert.equal(receiptText(RECEIPT_DEFAULTS, data).width, 48);
  const narrow = { ...RECEIPT_DEFAULTS, paper: 58 as const };
  assert.equal(receiptText(narrow, data).width, 32);
  const name = "Abdulazizbek Muhammadqodirov Ikromjon o'g'li Toshkent";
  const r = receiptText(narrow, { ...data, student: name });
  assert.ok(r.rows.every(([l, v]) => l.length + 1 + v.length <= 32), JSON.stringify(r.rows));
  const start = r.rows.findIndex(([l]) => l === "O'quvchi");
  let joined = r.rows[start][1];
  for (let i = start + 1; i < r.rows.length && r.rows[i][0] === ""; i++) joined += r.rows[i][1];
  assert.equal(joined, name);
});

test("logo: PNG or JPG only, up to 300 KB", () => {
  assert.equal(logoProblem("data:image/png;base64,iVBORw0KGgo="), null);
  assert.equal(logoProblem("data:image/jpeg;base64,/9j/4AAQ"), null);
  assert.equal(logoProblem("data:image/svg+xml;base64,PHN2Zz4="), "Faqat PNG yoki JPG");
  assert.equal(logoProblem("hello"), "Faqat PNG yoki JPG");
  const big = "data:image/jpeg;base64," + "A".repeat(Math.ceil((301 * 1024 * 4) / 3));
  assert.equal(logoProblem(big), "Logotip 300 KB dan katta");
});

test("the settings preview has a sample payment", () => {
  assert.ok(SAMPLE_RECEIPT.amount > 0);
  assert.ok(receiptText(RECEIPT_DEFAULTS, SAMPLE_RECEIPT).rows.length > 0);
});
