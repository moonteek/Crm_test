import { z } from "zod";
import { MONTHS, money, PAYMENT_METHODS } from "./format";
import { centreToday } from "./schedule";

// Payment receipts ("Chek"): what the settings hold and how one payment becomes the receipt's lines. The settings
// preview, the print page and the PDF all draw from receiptText(), so they always match.

export const RECEIPT_LINES = ["number", "time", "student", "teacher", "taker", "group", "month", "method"] as const;
export type ReceiptLine = (typeof RECEIPT_LINES)[number];

export const RECEIPT_LINE_LABEL: Record<ReceiptLine, string> = {
  number: "Chek №", time: "Vaqt", student: "O'quvchi", teacher: "O'qituvchi", taker: "Mas'ul", group: "Guruh",
  month: "Qaysi oy uchun", method: "To'lov turi",
};

export type ReceiptSettings = {
  name: string; phone: string; address: string; paper: 80 | 58;
  showLogo: boolean;
  /** uploaded logo as a PNG/JPG data URL; null = the built-in Algoritm logo */
  logo: string | null;
  lines: Record<ReceiptLine, boolean>;
};

export const RECEIPT_DEFAULTS: ReceiptSettings = {
  name: "Algoritm", phone: "", address: "", paper: 80, showLogo: true, logo: null,
  lines: Object.fromEntries(RECEIPT_LINES.map((l) => [l, true])) as Record<ReceiptLine, boolean>,
};

// each field falls back on its own, so an old or damaged stored value never breaks the receipt
const fallback = <T extends z.ZodType>(schema: T, value: z.infer<T>) => schema.catch(value);
const settingsSchema = z.object({
  name: fallback(z.string().trim().min(1).max(60), RECEIPT_DEFAULTS.name),
  phone: fallback(z.string().trim().max(40), ""),
  address: fallback(z.string().trim().max(120), ""),
  paper: fallback(z.union([z.literal(80), z.literal(58)]), 80),
  showLogo: fallback(z.boolean(), true),
  logo: fallback(z.string().nullable(), null),
  lines: fallback(
    z.object(Object.fromEntries(RECEIPT_LINES.map((l) => [l, fallback(z.boolean(), true)])) as Record<ReceiptLine, z.ZodType<boolean>>),
    RECEIPT_DEFAULTS.lines,
  ),
});

/** The stored JSON (Setting "receipt") as settings; anything missing or invalid takes its default. */
export function parseReceiptSettings(json: string | null): ReceiptSettings {
  let raw: unknown = {};
  try { raw = json ? JSON.parse(json) : {}; } catch { raw = {}; }
  const parsed = settingsSchema.safeParse(raw && typeof raw === "object" ? raw : {});
  if (!parsed.success) return RECEIPT_DEFAULTS;
  const s = parsed.data as ReceiptSettings;
  if (s.logo !== null && logoProblem(s.logo)) s.logo = null;
  return s;
}

export type ReceiptData = {
  id: number;
  /** the payment's day (UTC midnight) */
  date: Date;
  /** when it was saved: gives the receipt's time of day */
  recordedAt: Date;
  student: string; teacher: string | null; taker: string | null; group: string | null;
  month: Date | null; method: string; amount: number;
};

export const SAMPLE_RECEIPT: ReceiptData = {
  id: 1234, date: new Date(Date.UTC(2026, 9, 12)), recordedAt: new Date(Date.UTC(2026, 9, 12, 3, 54)),
  student: "Azamjon Qo'chqorov", teacher: "Odilov Azizbek", taker: "Karimov Muhammad Ali", group: "A100",
  month: new Date(Date.UTC(2026, 9, 1)), method: "CASH", amount: 200_000,
};

/** Characters per line on the roll: 48 on 80 mm, 32 on 58 mm. */
export const receiptWidth = (paper: 80 | 58) => (paper === 58 ? 32 : 48);

const pad = (n: number) => String(n).padStart(2, "0");

/** Splits `text` so its first piece fits `first` characters and the rest fit `rest`, at spaces where possible. */
function wrap(text: string, first: number, rest: number): string[] {
  const out: string[] = [];
  let left = text;
  let room = first;
  while (left.length > room) {
    const space = left.lastIndexOf(" ", room - 1);
    const cut = space > 0 ? space + 1 : room; // keep the space with the earlier piece
    out.push(left.slice(0, cut));
    left = left.slice(cut);
    room = rest;
  }
  out.push(left);
  return out;
}

/** The receipt as plain text: header lines, [label, value] rows (a long value continues on rows with label ""), total. */
export function receiptText(s: ReceiptSettings, d: ReceiptData) {
  const width = receiptWidth(s.paper);
  const t = centreToday(d.recordedAt);
  const values: Record<ReceiptLine, string | null> = {
    number: String(d.id),
    time: `${pad(d.date.getUTCDate())}.${pad(d.date.getUTCMonth() + 1)}.${d.date.getUTCFullYear()} ${pad(t.hour)}:${pad(t.minute)}`,
    student: d.student,
    teacher: d.teacher ?? "—",
    taker: d.taker ?? "—",
    group: d.group ?? "—",
    month: d.month ? `${MONTHS[d.month.getUTCMonth()]} ${d.month.getUTCFullYear()}` : null,
    method: PAYMENT_METHODS[d.method] ?? d.method,
  };
  const rows: [string, string][] = [];
  for (const line of RECEIPT_LINES) {
    const value = values[line];
    if (!s.lines[line] || value === null) continue;
    const label = RECEIPT_LINE_LABEL[line];
    const [head, ...more] = wrap(value, width - label.length - 1, width - 1);
    rows.push([label, head], ...more.map((v): [string, string] => ["", v]));
  }
  return {
    header: [s.name, s.phone, s.address].filter(Boolean),
    rows,
    total: ["Jami:", money(d.amount)] as [string, string],
    footer: "Rahmat!",
    width,
  };
}

const LOGO_MAX = 300 * 1024;

/** Why an uploaded logo can't be used (null when it's fine): PNG or JPG data URL, up to 300 KB. */
export function logoProblem(dataUrl: string): string | null {
  const m = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return "Faqat PNG yoki JPG";
  const b64 = m[2];
  const bytes = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  return bytes > LOGO_MAX ? "Logotip 300 KB dan katta" : null;
}
