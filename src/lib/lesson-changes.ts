import { lessonWeekdays } from "./format";
import { centreToday } from "./schedule";

// One group's lesson on one day can be cancelled ("Darsni qoldirish": a closed day for that group, like a holiday)
// or taught by a substitute ("O'qituvchini almashtirish": that lesson's pay goes to them).

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function lessonChangeProblem(
  input: {
    kind: "CANCEL" | "SUBSTITUTE";
    date: Date;
    days: string;
    holidays: string[];
    existing: { kind: string; date: Date }[];
    substituteId?: number | null;
    absentId?: number | null;
  },
  today: Date,
): string | null {
  if (!lessonWeekdays(input.days).includes(input.date.getUTCDay())) return "Bu kunda dars yo'q";
  if (input.holidays.includes(iso(input.date))) return "Bayram kuni — dars yo'q";
  const t = centreToday(today);
  if (input.date.getTime() < Date.UTC(t.year, t.month - 1, 1)) return "Faqat shu oydan boshlab";
  const same = input.existing.filter((e) => iso(e.date) === iso(input.date));
  if (same.some((e) => e.kind === "CANCEL")) return "Bu dars allaqachon bekor qilingan";
  if (input.kind === "CANCEL" && same.some((e) => e.kind === "SUBSTITUTE")) return "Bu darsga o'rinbosar biriktirilgan — avval uni bekor qiling";
  if (input.kind === "SUBSTITUTE") {
    if (!input.substituteId) return "O'rinbosarni tanlang";
    if (input.substituteId === input.absentId) return "O'zini o'zi almashtira olmaydi";
  }
  return null;
}

/** The days a group has no lesson: the centre's holidays and its own cancelled lessons (ISO, each once). */
export const closedDays = (holidays: string[], cancelled: Date[]) => [...new Set([...holidays, ...cancelled.map(iso)])];

/** Who taught `role` on `day`: a substitute for that day and role, else the regular person. */
export function whoTaught(day: Date, role: string, regular: number | null, subs: { date: Date; role: string | null; substituteId: number | null }[]) {
  const sub = subs.find((s) => s.role === role && iso(s.date) === iso(day));
  return sub ? sub.substituteId : regular;
}
