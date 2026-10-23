
/** Teaching days, Monday (1) to Saturday (6); JS `Date.getDay()` numbering. */
export const WEEKDAYS = [
  { day: 1, label: "Dushanba", short: "Du" },
  { day: 2, label: "Seshanba", short: "Se" },
  { day: 3, label: "Chorshanba", short: "Chor" },
  { day: 4, label: "Payshanba", short: "Pay" },
  { day: 5, label: "Juma", short: "Ju" },
  { day: 6, label: "Shanba", short: "Sha" },
];

/**
 * The date of `weekday` in the week the timetable shows (Monday first; on Sunday, the coming week). `today` is the
 * centre's date (UTC midnight); its weekday decides the week.
 */
export function dateThisWeek(weekday: number, today: Date) {
  const t = today.getUTCDay();
  return new Date(today.getTime() + (((weekday + 6) % 7) - ((t + 6) % 7) + (t === 0 ? 7 : 0)) * 86_400_000);
}

const CENTRE_TZ = "Asia/Tashkent";
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const CENTRE_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: CENTRE_TZ, weekday: "short", day: "numeric", month: "numeric", year: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23",
});

/** The date and hour at the centre (month is 1-based), whatever timezone the server runs in. */
export function centreToday(d = new Date()) {
  const p = Object.fromEntries(CENTRE_PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return { weekday: WEEKDAY_INDEX[p.weekday], day: Number(p.day), month: Number(p.month), year: Number(p.year), hour: Number(p.hour), minute: Number(p.minute) };
}

/** Weekday (0 = Sunday) at the centre. */
export const centreWeekday = (d = new Date()) => centreToday(d).weekday;

export function greeting(hour: number) {
  if (hour >= 5 && hour < 12) return "Xayrli tong";
  if (hour >= 12 && hour < 18) return "Xayrli kun";
  if (hour >= 18 && hour < 23) return "Xayrli kech";
  return "Xayrli tun";
}

export const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const fromMinutes = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

type Lesson = { id: number; start: number; end: number; roomId: number | null; teacherIds: number[] };

/**
 * Lessons that overlap in time with another lesson in the same room or with the same teacher.
 * Returns, per lesson id, which kinds of clash it has.
 */
export function findClashes(lessons: Lesson[]) {
  const clashes = new Map<number, { room: boolean; teacher: boolean }>();
  const mark = (id: number, kind: "room" | "teacher") => {
    const c = clashes.get(id) ?? { room: false, teacher: false };
    c[kind] = true;
    clashes.set(id, c);
  };
  for (let i = 0; i < lessons.length; i++) {
    for (let j = i + 1; j < lessons.length; j++) {
      const a = lessons[i];
      const b = lessons[j];
      if (a.start >= b.end || b.start >= a.end) continue;
      if (a.roomId !== null && a.roomId === b.roomId) {
        mark(a.id, "room");
        mark(b.id, "room");
      }
      if (a.teacherIds.some((t) => b.teacherIds.includes(t))) {
        mark(a.id, "teacher");
        mark(b.id, "teacher");
      }
    }
  }
  return clashes;
}

/** Midnight (server time) on the 1st of the centre's current month, for "this month" queries. */
export function centreMonthStart(d = new Date()) {
  const t = centreToday(d);
  return new Date(t.year, t.month - 1, 1);
}
