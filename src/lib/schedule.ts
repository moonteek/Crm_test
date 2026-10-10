/** Teaching days, Monday (1) to Saturday (6); JS `Date.getDay()` numbering. */
export const WEEKDAYS = [
  { day: 1, label: "Dushanba", short: "Du" },
  { day: 2, label: "Seshanba", short: "Se" },
  { day: 3, label: "Chorshanba", short: "Chor" },
  { day: 4, label: "Payshanba", short: "Pay" },
  { day: 5, label: "Juma", short: "Ju" },
  { day: 6, label: "Shanba", short: "Sha" },
];

const DAYS_OF: Record<string, number[]> = { ODD: [1, 3, 5], EVEN: [2, 4, 6], DAILY: [1, 2, 3, 4, 5, 6] };

/** The group `days` values that have a lesson on this weekday (none on Sunday). */
export function scheduleKeysOn(weekday: number) {
  return Object.keys(DAYS_OF).filter((k) => DAYS_OF[k].includes(weekday));
}

export const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const fromMinutes = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

type Lesson = { id: number; time: string; lessonMin: number; roomId: number | null; teacherIds: number[] };

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
      const aStart = toMinutes(a.time);
      const bStart = toMinutes(b.time);
      if (aStart >= bStart + b.lessonMin || bStart >= aStart + a.lessonMin) continue;
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
