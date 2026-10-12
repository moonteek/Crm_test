import { heldLessons } from "./format";
import { centreToday } from "./schedule";

// A course is an ordered list of subjects, each so many months long. A group moves through them one level a
// month, counted from its own start day (start 20 Oct → level 1 = 20 Oct–19 Nov). A level has however many lessons
// fall in that month on the group's days — about 13 on odd/even days, so 12–14 in practice.

/** `holidays`: the centre's closed days (ISO) — not lessons, so they don't count toward a level. */
export type CurriculumGroup = { startDate: Date; days: string; startSubjectId: number | null; startLevel: number; holidays: string[] };
export type CurriculumSubject = { id: number; name: string; months: number; position: number };

export type Window = {
  /** course month number, counted from the course's first subject (a group starting part-way starts higher) */
  level: number;
  subjectId: number;
  subject: string;
  levelInSubject: number;
  subjectLevels: number;
  from: Date;
  to: Date;
  lessons: Date[];
};

const DAY = 86_400_000;
const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
/** The start date on the centre's calendar: older rows hold Tashkent midnight (19:00 UTC the day before). */
const centreDate = (d: Date) => {
  const t = centreToday(d);
  return new Date(Date.UTC(t.year, t.month - 1, t.day));
};

/** `date` plus `n` months; a day the target month lacks (29–31) becomes that month's last day. */
export function addMonthsClamped(date: Date, n: number) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), last)));
}

function lessonsBetween(days: string, from: Date, to: Date, holidays: string[]) {
  const out: Date[] = [];
  for (let y = from.getUTCFullYear(), m = from.getUTCMonth(); y * 12 + m <= to.getUTCFullYear() * 12 + to.getUTCMonth(); m === 11 ? (y++, (m = 0)) : m++) {
    for (const l of heldLessons(days, y, m, holidays)) if (l >= from && l <= to) out.push(l);
  }
  return out;
}

export function levelWindows(group: CurriculumGroup, subjects: CurriculumSubject[]): Window[] {
  const ordered = [...subjects].sort((a, b) => a.position - b.position);
  const steps = ordered.flatMap((s) => Array.from({ length: s.months }, (_, i) => ({ s, levelInSubject: i + 1 })));
  if (!steps.length) return [];
  // the start subject's level, capped at its months (a subject shortened later keeps the group in it); missing subject → beginning
  const subjectAt = steps.findIndex((x) => x.s.id === group.startSubjectId);
  const first = subjectAt < 0 ? 0 : subjectAt + Math.min(Math.max(group.startLevel, 1), steps[subjectAt].s.months) - 1;
  const start = centreDate(group.startDate);
  return steps.slice(first).map((x, k) => {
    const from = addMonthsClamped(start, k);
    const to = new Date(addMonthsClamped(start, k + 1).getTime() - DAY);
    return {
      level: first + k + 1,
      subjectId: x.s.id,
      subject: x.s.name,
      levelInSubject: x.levelInSubject,
      subjectLevels: x.s.months,
      from,
      to,
      lessons: lessonsBetween(group.days, from, to, group.holidays),
    };
  });
}

export type Progress = {
  state: "none" | "not-started" | "in-progress" | "finishing" | "finished";
  window: Window | null;
  doneInWindow: number;
  lessonsInWindow: number;
  done: number;
  total: number;
  percent: number;
};

/** Where the group is on `day`: current level, lessons done in it and in the whole course. */
export function progressOn(group: CurriculumGroup, subjects: CurriculumSubject[], day: Date): Progress {
  const windows = levelWindows(group, subjects);
  const total = windows.reduce((s, w) => s + w.lessons.length, 0);
  const pct = (done: number) => (total ? Math.min(100, Math.round((done / total) * 100)) : 0);
  if (!windows.length) return { state: "none", window: null, doneInWindow: 0, lessonsInWindow: 0, done: 0, total: 0, percent: 0 };
  const today = utcDay(day);
  if (today < windows[0].from) return { state: "not-started", window: null, doneInWindow: 0, lessonsInWindow: windows[0].lessons.length, done: 0, total, percent: 0 };
  const last = windows[windows.length - 1];
  if (today > last.to) return { state: "finished", window: last, doneInWindow: last.lessons.length, lessonsInWindow: last.lessons.length, done: total, total, percent: 100 };
  const i = windows.findIndex((w) => today >= w.from && today <= w.to);
  const w = windows[i];
  const doneInWindow = w.lessons.filter((l) => l <= today).length;
  const done = windows.slice(0, i).reduce((s, x) => s + x.lessons.length, 0) + doneInWindow;
  return { state: i === windows.length - 1 ? "finishing" : "in-progress", window: w, doneInWindow, lessonsInWindow: w.lessons.length, done, total, percent: pct(done) };
}

/** The level exam of every level: its last lesson day. */
export function levelExams(group: CurriculumGroup, subjects: CurriculumSubject[]) {
  return levelWindows(group, subjects)
    .filter((w) => w.lessons.length)
    .map((w) => ({ level: w.level, subject: w.subject, levelInSubject: w.levelInSubject, date: w.lessons[w.lessons.length - 1], title: `${w.subject} · ${w.levelInSubject}-daraja imtihoni` }));
}

/** Everything a group screen needs on `day`: level windows, progress and the next level exam. */
export function curriculumOn(group: CurriculumGroup, subjects: CurriculumSubject[], day: Date) {
  const windows = levelWindows(group, subjects);
  const progress = progressOn(group, subjects, day);
  const nextExam = levelExams(group, subjects).find((e) => e.date >= new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))) ?? null;
  return { windows, progress, nextExam };
}

export const passed = (score: number, maxScore: number, passPercent: number) => (score / maxScore) * 100 >= passPercent;
