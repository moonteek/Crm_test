import { lessonWeekdays, money, MONTHS } from "./format";
import { centreToday, fromMinutes, toMinutes } from "./schedule";
import { teacherOn, type TeacherRow } from "./teachers-history";
import { whoTaught } from "./lesson-changes";
import { phoneKey } from "./phone";

// Telegram messages: which ones are due now and what they say. Pure — the bot and the CRM actions do the sending.

export type Outgoing = { key: string; userId: number; text: string };

export type PlanGroup = {
  id: number; name: string; time: string; days: string; startDate: Date; lessonMin: number; room: string | null;
  teacherId: number | null; assistantId: number | null; teachers: TeacherRow[];
  /** active students */
  students: number;
  /** lessons held up to today, today included (lessonsPassed) */
  passed: number;
};

export type PlanContext = {
  now: Date;
  /** a group's closed days (holidays + its cancelled lessons), ISO */
  closed: (groupId: number) => string[];
  subs: { groupId: number; date: Date; role: string | null; substituteId: number | null }[];
  /** groups with any attendance mark today */
  markedGroups: Set<number>;
  /** active staff with a linked chat */
  linked: Map<number, { name: string; isAdmin: boolean }>;
};

const REMIND_BEFORE = 30;
const NUDGE_AFTER = 15;
/** a message is due only this long after its time: no burst of stale ones after a restart or outage */
const WINDOW = 10;

const pad = (n: number) => String(n).padStart(2, "0");
const ddmm = (d: Date) => `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}`;

/** Who teaches the group on `day`, both roles: teacher history, then that day's substitutes. */
function teachersOn(g: PlanGroup, day: Date, subs: PlanContext["subs"]) {
  const own = subs.filter((s) => s.groupId === g.id);
  const ids = (["TEACHER", "ASSISTANT"] as const).map((role) => whoTaught(day, role, teacherOn(g.teachers, g, day, role), own));
  return [...new Set(ids.filter((id): id is number => id !== null))];
}

/** Lesson reminders, "not marked" nudges and the admins' unmarked list that are due at `ctx.now`. */
export function dueMessages(groups: PlanGroup[], ctx: PlanContext): Outgoing[] {
  const t = centreToday(ctx.now);
  const day = new Date(Date.UTC(t.year, t.month - 1, t.day));
  const iso = day.toISOString().slice(0, 10);
  const now = t.hour * 60 + t.minute;
  const inWindow = (at: number) => now >= at && now < at + WINDOW;
  const out: Outgoing[] = [];
  const unmarked: PlanGroup[] = [];

  for (const g of groups) {
    if (!lessonWeekdays(g.days).includes(t.weekday) || g.startDate.getTime() > day.getTime() || g.students === 0) continue;
    if (ctx.closed(g.id).includes(iso)) continue;
    const start = toMinutes(g.time);
    const people = teachersOn(g, day, ctx.subs).filter((id) => ctx.linked.has(id));
    if (inWindow(start - REMIND_BEFORE)) {
      const text = `⏰ 30 daqiqadan keyin dars: ${g.name}, ${g.time}–${fromMinutes(start + g.lessonMin)}${g.room ? `, ${g.room}` : ""}. Bugun ${g.passed}-dars.`;
      for (const id of people) out.push({ key: `reminder:${g.id}:${iso}:${id}`, userId: id, text });
    }
    if (inWindow(start + NUDGE_AFTER) && !ctx.markedGroups.has(g.id)) {
      unmarked.push(g);
      for (const id of people) out.push({ key: `unmarked:${g.id}:${iso}:${id}`, userId: id, text: `📋 ${g.name} (${g.time}) davomati hali belgilanmagan.` });
    }
  }

  if (unmarked.length) {
    const ids = unmarked.map((g) => g.id).sort((a, b) => a - b).join(",");
    const text = `📋 Davomat qilinmagan: ${unmarked.map((g) => `${g.name} (${g.time})`).join(", ")}`;
    for (const [id, u] of ctx.linked) if (u.isAdmin) out.push({ key: `admin-unmarked:${iso}:${ids}:${id}`, userId: id, text });
  }
  return out;
}

export const cancelText = (group: string, day: Date, reason: string | null) => `❌ ${ddmm(day)} ${group} darsi bekor qilindi${reason ? `: ${reason}` : ""}`;
export const restoreText = (group: string, day: Date) => `✅ ${ddmm(day)} ${group} darsi qayta tiklandi`;
export const substituteTexts = (group: string, day: Date, time: string, substitute: string, absent: string | null) => ({
  toSubstitute: `🔁 ${ddmm(day)} ${time} ${group} darsini siz o'tasiz${absent ? ` (${absent} o'rniga)` : ""}`,
  toAbsent: `🔁 ${ddmm(day)} ${group} darsingizni ${substitute} o'tadi`,
});
export const substituteUndoText = (group: string, day: Date) => `↩️ ${ddmm(day)} ${group}: o'rinbosar bekor qilindi`;
/** `month` as YYYY-MM */
export function salaryText(month: string, amount: number) {
  const [y, m] = month.split("-").map(Number);
  return `💰 ${MONTHS[m - 1]} ${y} uchun ish haqi to'landi: ${money(amount)}`;
}

/** The bot's answer to /start, text or a shared contact: who to link (if anyone) and what to say. */
export function linkReply(
  msg: { fromId: number; contact?: { userId?: number; phone: string } },
  staff: { id: number; name: string; phone: string; active: boolean }[],
): { userId: number | null; text: string } {
  if (!msg.contact) return { userId: null, text: "Ulanish uchun pastdagi «📱 Raqamni yuborish» tugmasini bosing." };
  if (msg.contact.userId !== msg.fromId) return { userId: null, text: "Faqat o'zingizning raqamingizni yuboring." };
  const key = phoneKey(msg.contact.phone);
  const person = staff.find((s) => s.active && phoneKey(s.phone) === key);
  if (!person) return { userId: null, text: "Bu raqam CRM'da topilmadi. Administratorga murojaat qiling." };
  return { userId: person.id, text: `✅ Ulandingiz, ${person.name}. Endi darslar haqida xabarlar shu yerga keladi.` };
}
