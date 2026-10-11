import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { fmtDate, toTsv, toXlsx } from "./export";

const t = { title: "O'quvchilar", columns: ["Ism", "Izoh"], rows: [["O'g'il", "a\tb\nc"], [null, 5]] as (string | number | null)[][] };

test("tsv keeps columns: tabs/newlines inside cells become spaces", () => {
  assert.equal(toTsv(t), "Ism\tIzoh\nO'g'il\ta b c\n\t5");
});

test("xlsx: sheet name, bold header, numbers stay numbers, Uzbek text intact", async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await toXlsx(t)) as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  assert.equal(ws.name, "O'quvchilar");
  assert.equal(ws.getCell("A1").font?.bold, true);
  assert.equal(ws.getCell("A2").value, "O'g'il");
  assert.equal(ws.getCell("B3").value, 5);
});

test("dates as DD.MM.YYYY", () => {
  assert.equal(fmtDate(new Date("2026-10-11T00:00:00Z")), "11.10.2026");
  assert.equal(fmtDate(null), "");
});

test("tsv: text that a sheet would turn into a formula or a number stays text", () => {
  const t2 = { title: "x", columns: ["A"], rows: [["+998 90 123 45 67"], ["=IMAGE(\"https://x\")"], ["-5 so'm"], ["@x"], [1500]] as (string | number | null)[][] };
  assert.equal(toTsv(t2), "A\n'+998 90 123 45 67\n'=IMAGE(\"https://x\")\n'-5 so'm\n'@x\n1500");
});
