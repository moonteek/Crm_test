import { isLessonDay, type DaysScheduled } from "./group-schedule";

// The horizontal timetable: rooms down, the day's hours across, each lesson a card at its time.

/** Course colours (Course.color). No red: it reads as an error. Tints live in globals.css (--course-*). */
export const COURSE_COLORS = ["amber", "green", "blue", "purple", "pink", "teal", "orange", "grey"] as const;
export type CourseColor = (typeof COURSE_COLORS)[number];

export const COURSE_COLOR_LABEL: Record<CourseColor, string> = {
  amber: "Sariq", green: "Yashil", blue: "Ko'k", purple: "Binafsha", pink: "Pushti", teal: "Moviy-yashil", orange: "To'q sariq", grey: "Kulrang",
};

/** The course's chosen colour; a course without one gets a steady colour from its id. */
export function courseColor(course: { id: number; color: string | null }): CourseColor {
  if ((COURSE_COLORS as readonly string[]).includes(course.color ?? "")) return course.color as CourseColor;
  return COURSE_COLORS[(course.id - 1 + COURSE_COLORS.length) % COURSE_COLORS.length];
}

const DAY_FROM = 8 * 60;
const DAY_TO = 22 * 60;

/** The hours shown (minutes): 08:00–22:00, widened to whole half hours when a lesson starts earlier or ends later. */
export function timelineRange(lessons: { start: number; end: number }[]) {
  const from = Math.min(DAY_FROM, ...lessons.map((l) => Math.floor(l.start / 30) * 30));
  const to = Math.max(DAY_TO, ...lessons.map((l) => Math.ceil(l.end / 30) * 30));
  return { from, to };
}

/** Where a card sits on the timeline, in % of its width. */
export function placeOn(range: { from: number; to: number }, start: number, end: number) {
  const span = range.to - range.from;
  return { left: ((start - range.from) / span) * 100, width: ((end - start) / span) * 100 };
}

/** Lessons that overlap in one room go into separate lanes (rows inside the room); `count` is at least 1. */
export function lanes(lessons: { id: number; start: number; end: number }[]) {
  const lane = new Map<number, number>();
  const ends: number[] = []; // per lane: when its last lesson ends
  for (const l of [...lessons].sort((a, b) => a.start - b.start || a.end - b.end)) {
    let i = ends.findIndex((e) => e <= l.start);
    if (i < 0) i = ends.push(0) - 1;
    ends[i] = l.end;
    lane.set(l.id, i);
  }
  return { lane, count: Math.max(1, ends.length) };
}

/** Lessons held from the group's start up to `day` (inclusive), not counting closed days (ISO). */
export function lessonsPassed(group: DaysScheduled & { startDate: Date }, closed: string[], day: Date) {
  const off = new Set(closed);
  let n = 0;
  for (const d = new Date(group.startDate); d.getTime() <= day.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    if (isLessonDay(group, d) && !off.has(d.toISOString().slice(0, 10))) n++;
  }
  return n;
}

/** Card classes per course colour (written out in full so Tailwind sees them). */
export const COURSE_TONE: Record<CourseColor, { card: string; ink: string }> = {
  amber: { card: "border-course-amber bg-course-amber-tint", ink: "text-course-amber" },
  green: { card: "border-course-green bg-course-green-tint", ink: "text-course-green" },
  blue: { card: "border-course-blue bg-course-blue-tint", ink: "text-course-blue" },
  purple: { card: "border-course-purple bg-course-purple-tint", ink: "text-course-purple" },
  pink: { card: "border-course-pink bg-course-pink-tint", ink: "text-course-pink" },
  teal: { card: "border-course-teal bg-course-teal-tint", ink: "text-course-teal" },
  orange: { card: "border-course-orange bg-course-orange-tint", ink: "text-course-orange" },
  grey: { card: "border-course-grey bg-course-grey-tint", ink: "text-course-grey" },
};
