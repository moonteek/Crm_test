import { centreToday } from "./schedule";

// Days the whole centre is closed: no lesson happens, so they aren't charged, paid, marked or counted in the course
// plan. Stored as calendar days (UTC midnight); added from this month onward only.

const DAY = 86_400_000;
const MAX_DAYS = 31;
const pad = (n: number) => String(n).padStart(2, "0");
const label = (d: Date) => `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
/** The centre's today as a UTC-midnight day. */
const centreDate = (now: Date) => {
  const t = centreToday(now);
  return Date.UTC(t.year, t.month - 1, t.day);
};

/** Every day from `from` to `to` (inclusive); just `from` when there is no end. Empty when the end is earlier. */
export function expandRange(from: Date, to: Date | null): Date[] {
  const end = (to ?? from).getTime();
  const out: Date[] = [];
  for (let t = from.getTime(); t <= end && out.length <= MAX_DAYS; t += DAY) out.push(new Date(t));
  return out;
}

export function holidayProblem(dates: Date[], existing: { date: Date; name: string }[], today: Date): string | null {
  if (!dates.length) return "Tugash sanasi boshlanishdan oldin";
  if (dates.length > MAX_DAYS) return "Oraliq 31 kundan oshmasin";
  const t = centreToday(today);
  if (dates[0].getTime() < Date.UTC(t.year, t.month - 1, 1)) return "Bayram kunlari shu oydan boshlab qo'shiladi";
  const taken = existing.find((e) => dates.some((d) => d.getTime() === e.date.getTime()));
  if (taken) return `${label(taken.date)} allaqachon bayram: ${taken.name}`;
  return null;
}

/** Today's or a past holiday was already charged and paid for; only future ones can go. */
export const canDeleteHoliday = (date: Date, now: Date) => date.getTime() > centreDate(now);
