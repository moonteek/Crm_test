import { MONTHS, PAYMENT_METHODS } from "./format";
import { centreToday } from "./schedule";

// Payment form defaults, the "which month" label and edit history: plain rules shared by the form, the list and tests.

const pad = (n: number) => String(n).padStart(2, "0");
const num = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const monthLabel = (ym: string | null) => {
  if (!ym) return "—";
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

/** What the cashier is offered: the debt when there is one, otherwise the group's monthly price. */
export const defaultAmount = (balance: number, monthlyPrice: number) => (balance < 0 ? -balance : monthlyPrice);

/** "Qaysi oy uchun": last month, this month and three ahead (YYYY-MM). */
export function monthOptions(today: Date) {
  const t = centreToday(today);
  return [-1, 0, 1, 2, 3].map((k) => {
    const d = new Date(Date.UTC(t.year, t.month - 1 + k, 1));
    const value = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
    return { value, label: monthLabel(value) };
  });
}

export type PaymentSnapshot = { amount: number; method: string; date: string; month: string | null; note: string | null };

/** One line for the payments list: only the fields that changed ("780 000 → 790 000, Naqd → Karta"). */
export function editDiff(before: PaymentSnapshot, after: PaymentSnapshot) {
  const parts: string[] = [];
  if (before.amount !== after.amount) parts.push(`${num(before.amount)} → ${num(after.amount)}`);
  if (before.method !== after.method) parts.push(`${PAYMENT_METHODS[before.method] ?? before.method} → ${PAYMENT_METHODS[after.method] ?? after.method}`);
  if (before.date !== after.date) parts.push(`sana: ${before.date.split("-").reverse().join(".")} → ${after.date.split("-").reverse().join(".")}`);
  if (before.month !== after.month) parts.push(`oy: ${monthLabel(before.month)} → ${monthLabel(after.month)}`);
  if ((before.note ?? "") !== (after.note ?? "")) parts.push("izoh o'zgardi");
  return parts.join(", ");
}

export type PaymentFilters = { from: Date; to: Date; q: string; groupId: number | null; teacherId: number | null; userId: number | null; method: string | null };

const id = (x?: string) => (Number.isInteger(Number(x)) && Number(x) > 0 ? Number(x) : null);
const day = (x?: string) => (x && /^\d{4}-\d{2}-\d{2}$/.test(x) ? new Date(`${x}T00:00:00Z`) : null);

/** The payments list filters from the URL; the date range defaults to this month. */
export function parsePaymentFilters(p: Record<string, string | undefined>, today: Date): PaymentFilters {
  const t = centreToday(today);
  return {
    from: day(p.from) ?? new Date(Date.UTC(t.year, t.month - 1, 1)),
    to: day(p.to) ?? new Date(Date.UTC(t.year, t.month, 0)),
    q: (p.q ?? "").trim(),
    groupId: id(p.group),
    teacherId: id(p.teacher),
    userId: id(p.hodim),
    method: p.method && p.method in PAYMENT_METHODS ? p.method : null,
  };
}
