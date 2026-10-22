// A group's lesson days and lesson length. `Group.days` is ODD | EVEN | DAILY or a custom set of weekdays written
// ascending with commas ("1,4,6"; 1 = Monday … 6 = Saturday; Sunday is never a lesson day). A custom set equal to a
// named one is stored as the name, so labels and filters stay simple.

const NAMED: Record<string, number[]> = { ODD: [1, 3, 5], EVEN: [2, 4, 6], DAILY: [1, 2, 3, 4, 5, 6] };
const NAMED_LABEL: Record<string, string> = { ODD: "Du / Chor / Ju", EVEN: "Se / Pay / Sha", DAILY: "Har kuni" };
const SHORT = ["Ya", "Du", "Se", "Chor", "Pay", "Ju", "Sha"];

/** Lesson weekdays (JS numbering, 1 = Monday) of a stored `days` value; [] for anything unreadable. */
export function weekdaysOf(days: string): number[] {
  if (NAMED[days]) return NAMED[days];
  if (!/^[1-6](,[1-6])*$/.test(days)) return [];
  return days.split(",").map(Number);
}

/** The value to store for the chosen weekdays; null when there is none, or any isn't Monday … Saturday. */
export function normalizeDays(weekdays: number[]): string | null {
  if (!weekdays.length || weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 6)) return null;
  const set = [...new Set(weekdays)].sort((a, b) => a - b).join(",");
  return Object.keys(NAMED).find((k) => NAMED[k].join(",") === set) ?? set;
}

/** "Du / Chor / Ju", "Har kuni", or a custom set's short day names. */
export function daysLabel(days: string): string {
  return NAMED_LABEL[days] ?? (weekdaysOf(days).map((d) => SHORT[d]).join(" / ") || days);
}

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

type Timed = { time: string; endTime: string | null; course: { lessonMin: number } };

/** Lesson length in minutes: end − start, or the course's length when the group has no end time. */
export const lessonMinutes = (g: Timed) => (g.endTime ? minutes(g.endTime) - minutes(g.time) : g.course.lessonMin);

/** The lesson's end, "HH:MM". */
export const endOf = (g: Timed) => g.endTime ?? hhmm(minutes(g.time) + g.course.lessonMin);

const DAY_FROM = 8 * 60;
const DAY_TO = 20 * 60;
const MAX_LESSON = 4 * 60;

/** Why a start / end pair can't be a lesson (null when fine). */
export function timeProblem(time: string, endTime: string): string | null {
  const [s, e] = [minutes(time), minutes(endTime)];
  if (e <= s) return "Tugash vaqti boshlanishdan keyin bo'lishi kerak";
  if (e - s > MAX_LESSON) return "Dars 4 soatdan uzun bo'lmasin";
  if (s < DAY_FROM || e > DAY_TO) return "Dars 08:00–20:00 oralig'ida bo'lishi kerak";
  return null;
}

/**
 * The `days` to store from the group form: a named set as it is, or "CUSTOM" with the ticked weekdays sent as one
 * comma-separated field (the browser joins the Boshqa checkboxes). Throws the message to show.
 */
export function daysFromForm(days: string, customDays: string | null | undefined): string {
  if (days !== "CUSTOM") {
    if (!NAMED[days]) throw new Error("Dars kunlari noto'g'ri");
    return days;
  }
  const picked = (customDays ?? "").split(",").filter(Boolean).map(Number);
  const value = normalizeDays(picked);
  if (!value) throw new Error("Kamida bitta dars kunini tanlang");
  return value;
}
