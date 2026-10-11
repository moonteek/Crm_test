import { PER_LESSON_FROM } from "./billing";
import { centreToday } from "./schedule";

// Rules for discounts: months are UTC midnight on the 1st, `to` is inclusive. A discount covers this month onward
// (past months stay as charged) and never a month before per-lesson billing, whose teacher pay follows payments.

type Range = { from: Date; to: Date };
const key = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
/** This month at the centre, as a month key. */
const monthOf = (today: Date) => {
  const t = centreToday(today);
  return t.year * 12 + (t.month - 1);
};

export function discountProblem(input: Range & { amount: number; current: boolean }, existing: Range[], today: Date): string | null {
  if (!Number.isInteger(input.amount) || input.amount < 1) return "Chegirma summasi musbat bo'lishi kerak";
  if (key(input.from) > key(input.to)) return "Boshlanish oyi tugash oyidan keyin bo'lmasin";
  if (key(input.from) < monthOf(today)) return "Chegirma faqat shu oydan boshlab beriladi";
  if (key(input.from) < key(PER_LESSON_FROM)) return "Chegirma 2026-yil noyabrdan boshlab beriladi";
  if (!input.current) return "O'quvchi bu guruhda emas";
  if (existing.some((e) => key(e.from) <= key(input.to) && key(input.from) <= key(e.to))) return "Bu oylarda boshqa chegirma bor";
  return null;
}

export function discountState(d: Range, today: Date): "kutilmoqda" | "amalda" | "tugagan" {
  const now = monthOf(today);
  return key(d.to) < now ? "tugagan" : key(d.from) > now ? "kutilmoqda" : "amalda";
}

/** Nothing of it is in a past month yet. */
export const canDelete = (d: Range, today: Date) => key(d.from) >= monthOf(today);

/** Started before this month and still running: ending makes last month its final one. */
export const canEnd = (d: Range, today: Date) => key(d.from) < monthOf(today) && key(d.to) >= monthOf(today);

/** The previous month's 1st, the new `to` when ending a discount. */
export function lastMonth(today: Date) {
  const t = centreToday(today);
  return new Date(Date.UTC(t.year, t.month - 2, 1));
}

/**
 * A student left on `leaveDate`: their discounts in that group end with that month and the ones that hadn't started
 * are removed, so rejoining later doesn't silently bring an old discount back.
 */
export function discountsAfterLeave(discounts: (Range & { id: number })[], leaveDate: Date) {
  const left = key(leaveDate);
  const to = new Date(Date.UTC(leaveDate.getUTCFullYear(), leaveDate.getUTCMonth(), 1));
  return {
    remove: discounts.filter((d) => key(d.from) > left).map((d) => d.id),
    trim: discounts.filter((d) => key(d.from) <= left && key(d.to) > left).map((d) => ({ id: d.id, to })),
  };
}
