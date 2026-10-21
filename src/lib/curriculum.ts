import { heldLessons } from "./format";
import { centreToday } from "./schedule";

// A group studies one section of its course. The section is an ordered list of level lines ("JS", "Node.js ×3"),
// each level so many lessons long (usually 13 ≈ a month, sometimes 8). Counting from the group's start day, its
// lesson days go to the levels in order; closed days (holidays and the group's cancelled lessons) are skipped, so a
// cancellation moves that level, its exam (on the level's last lesson) and every later level by one lesson.

/** `holidays`: the group's closed days (ISO) — holidays and its cancelled lessons — which don't count as lessons. */
export type CurriculumGroup = { startDate: Date; days: string; startSubjectId: number | null; startLevel: number; holidays: string[] };
/** A level line of the group's section: `levels` levels of `lessons` lessons each. */
export type CurriculumSubject = { id: number; name: string; levels: number; lessons: number; position: number };

export type Window = {
  /** level number within the section, counted from its first level (a group starting part-way starts higher) */
  level: number;
  subjectId: number;
  /** the line's name ("Node.js") */
  subject: string;
  /** the level's label: the name, numbered when the line has several levels ("Node.js 2") */
  label: string;
  levelInSubject: number;
  subjectLevels: number;
  /** first and last lesson of the level */
  from: Date;
  to: Date;
  lessons: Date[];
};

const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
/** The start date on the centre's calendar: older rows hold Tashkent midnight (19:00 UTC the day before). */
const centreDate = (d: Date) => {
  const t = centreToday(d);
  return new Date(Date.UTC(t.year, t.month - 1, t.day));
};

/** "HTML" for a one-level line, "Node.js 2" inside a line of several. */
export function levelLabel(name: string, levelInSubject: number, levels: number) {
  return levels > 1 ? `${name} ${levelInSubject}` : name;
}

export const sectionLevels = (lines: CurriculumSubject[]) => lines.reduce((n, l) => n + l.levels, 0);
export const sectionLessons = (lines: CurriculumSubject[]) => lines.reduce((n, l) => n + l.levels * l.lessons, 0);

/** A course's length in months from its levels: its longest section, 13 lessons ≈ a month; null without levels. */
export function courseMonths(sections: { subjects: CurriculumSubject[] }[]): number | null {
  const lessons = Math.max(0, ...sections.map((s) => sectionLessons(s.subjects)));
  return lessons ? Math.max(1, Math.round(lessons / 13)) : null;
}

/** The group's next `count` held lessons from `start` (gives up after ten years of nothing). */
function heldFrom(days: string, start: Date, count: number, holidays: string[]) {
  const out: Date[] = [];
  for (let y = start.getUTCFullYear(), m = start.getUTCMonth(), k = 0; out.length < count && k < 120; k++, m === 11 ? (y++, (m = 0)) : m++) {
    for (const l of heldLessons(days, y, m, holidays)) if (l >= start && out.length < count) out.push(l);
  }
  return out;
}

export function levelWindows(group: CurriculumGroup, lines: CurriculumSubject[]): Window[] {
  const ordered = [...lines].sort((a, b) => a.position - b.position);
  const steps = ordered.flatMap((s) => Array.from({ length: Math.max(s.levels, 0) }, (_, i) => ({ s, levelInSubject: i + 1 })));
  if (!steps.length) return [];
  // the start line's level, capped at its levels (a line shortened later keeps the group in it); missing line → beginning
  const lineAt = steps.findIndex((x) => x.s.id === group.startSubjectId);
  const first = lineAt < 0 ? 0 : lineAt + Math.min(Math.max(group.startLevel, 1), steps[lineAt].s.levels) - 1;
  const taken = steps.slice(first);
  const all = heldFrom(group.days, centreDate(group.startDate), taken.reduce((n, x) => n + Math.max(x.s.lessons, 0), 0), group.holidays);
  const out: Window[] = [];
  let at = 0;
  for (const [k, x] of taken.entries()) {
    const lessons = all.slice(at, at + Math.max(x.s.lessons, 0));
    at += lessons.length;
    if (!lessons.length) break;
    out.push({
      level: first + k + 1,
      subjectId: x.s.id,
      subject: x.s.name,
      label: levelLabel(x.s.name, x.levelInSubject, x.s.levels),
      levelInSubject: x.levelInSubject,
      subjectLevels: x.s.levels,
      from: lessons[0],
      to: lessons[lessons.length - 1],
      lessons,
    });
  }
  return out;
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

/** Where the group is on `day`: current level (between two levels: the next one), lessons done in it and in the section. */
export function progressOn(group: CurriculumGroup, lines: CurriculumSubject[], day: Date): Progress {
  const windows = levelWindows(group, lines);
  const total = windows.reduce((s, w) => s + w.lessons.length, 0);
  const pct = (done: number) => (total ? Math.min(100, Math.round((done / total) * 100)) : 0);
  if (!windows.length) return { state: "none", window: null, doneInWindow: 0, lessonsInWindow: 0, done: 0, total: 0, percent: 0 };
  const today = utcDay(day);
  if (today < windows[0].from) return { state: "not-started", window: null, doneInWindow: 0, lessonsInWindow: windows[0].lessons.length, done: 0, total, percent: 0 };
  const last = windows[windows.length - 1];
  if (today > last.to) return { state: "finished", window: last, doneInWindow: last.lessons.length, lessonsInWindow: last.lessons.length, done: total, total, percent: 100 };
  const i = windows.findIndex((w) => today <= w.to);
  const w = windows[i];
  const doneInWindow = w.lessons.filter((l) => l <= today).length;
  const done = windows.slice(0, i).reduce((s, x) => s + x.lessons.length, 0) + doneInWindow;
  return { state: i === windows.length - 1 ? "finishing" : "in-progress", window: w, doneInWindow, lessonsInWindow: w.lessons.length, done, total, percent: pct(done) };
}

/** "Frontend · JS · 3/5-daraja · 7/13 dars" (no section name for single-section courses); "Bo'lim tugadi" at the end. */
export function progressLabel(sectionName: string | null, p: Progress, totalLevels: number) {
  if (p.state === "finished") return "Bo'lim tugadi";
  if (!p.window) return p.state === "not-started" ? "Boshlanmagan" : "";
  const parts = [sectionName, p.window.label, `${p.window.level}/${totalLevels}-daraja`, `${p.doneInWindow}/${p.lessonsInWindow} dars`];
  return parts.filter(Boolean).join(" · ");
}

/** The level exam of every level: its last lesson day. */
export function levelExams(group: CurriculumGroup, lines: CurriculumSubject[]) {
  return levelWindows(group, lines).map((w) => ({ level: w.level, subject: w.subject, levelInSubject: w.levelInSubject, date: w.to, title: `${w.label} imtihoni` }));
}

/** Everything a group screen needs on `day`: level windows, progress and the next level exam. */
export function curriculumOn(group: CurriculumGroup, lines: CurriculumSubject[], day: Date) {
  const windows = levelWindows(group, lines);
  const progress = progressOn(group, lines, day);
  const nextExam = levelExams(group, lines).find((e) => e.date >= utcDay(day)) ?? null;
  return { windows, progress, nextExam };
}

export const passed = (score: number, maxScore: number, passPercent: number) => (score / maxScore) * 100 >= passPercent;
