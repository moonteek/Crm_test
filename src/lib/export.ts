import ExcelJS from "exceljs";
import { centreToday } from "./schedule";

// One export format for every list: the page's loader builds a Table of exactly what the page shows (all pages),
// and its export route answers as an Excel file or as tab-separated text for pasting into Google Sheets.

export type Cell = string | number | null;
export type Table = { title: string; columns: string[]; rows: Cell[][] };

const pad = (n: number) => String(n).padStart(2, "0");

/** A day on the centre's calendar as DD.MM.YYYY ("" for none). */
export function fmtDate(d: Date | null) {
  if (!d) return "";
  const t = centreToday(d);
  return `${pad(t.day)}.${pad(t.month)}.${t.year}`;
}

const clean = (c: Cell) => (c === null ? "" : String(c).replace(/[\t\r\n]+/g, " "));

// A pasted cell is read like typed input: "+998 90…" would be a broken formula and "=…" a live one.
// A leading apostrophe keeps such text as text (the sheet doesn't show it).
const sheetText = (c: Cell) => (typeof c === "string" && /^[=+\-@]/.test(c) ? `'${clean(c)}` : clean(c));

export function toTsv(t: Table) {
  return [t.columns, ...t.rows].map((r) => r.map(sheetText).join("\t")).join("\n");
}

export async function toXlsx(t: Table): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  // sheet names can't hold []:*?/\ and are at most 31 characters
  const ws = wb.addWorksheet(t.title.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Jadval");
  ws.addRow(t.columns).font = { bold: true };
  for (const r of t.rows) ws.addRow(r.map((c) => (c === null ? null : c)));
  ws.columns.forEach((col, i) => {
    const longest = Math.max(t.columns[i]?.length ?? 0, ...t.rows.map((r) => clean(r[i] ?? null).length));
    col.width = Math.min(50, Math.max(8, longest + 2));
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** `?format=tsv` → text for the Sheets copy; anything else → an .xlsx download named "<title>-YYYY-MM-DD.xlsx". */
export async function respondTable(t: Table, format: string | null): Promise<Response> {
  if (format === "tsv") return new Response(toTsv(t), { headers: { "Content-Type": "text/tab-separated-values; charset=utf-8" } });
  const today = centreToday();
  const name = `${t.title}-${today.year}-${pad(today.month)}-${pad(today.day)}.xlsx`;
  return new Response(new Uint8Array(await toXlsx(t)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
