import "server-only";
import { db } from "../db";
import { groupScope, type CurrentUser } from "../access";
import { centreDay } from "../membership-db";
import { holidayDays } from "../holidays-db";
import { centreWeekday, dateThisWeek, fromMinutes, toMinutes, WEEKDAYS } from "../schedule";
import { lessonMinutes } from "../group-days";
import { isLessonDay, scheduleOn } from "../group-schedule";
import type { Table } from "../export";

/** One weekday of the timetable (as the page shows it, Monday on Sundays) for Excel / Google Sheets. */
export async function scheduleTable(user: CurrentUser, params: { d?: string }): Promise<Table> {
  const today = centreWeekday();
  const picked = Number(params.d);
  const day = WEEKDAYS.some((w) => w.day === picked) ? picked : today === 0 ? 1 : today;
  const label = WEEKDAYS.find((w) => w.day === day)!.label;
  // the shown weekday's date this week (Monday first; on Sunday, the coming week) — a holiday has no lessons
  const shown = dateThisWeek(day, centreDay());
  const closed = (await holidayDays()).includes(shown.toISOString().slice(0, 10));
  const all = closed ? [] : await db.group.findMany({
    where: { status: "ACTIVE", ...groupScope(user) },
    include: { course: true, teacher: true, assistant: true, room: true, schedules: true, _count: { select: { students: { where: { leftAt: null } } } } },
  });
  // that date's schedule of each group (a change dated later doesn't apply yet)
  const groups = all.filter((g) => isLessonDay(g, shown)).map((g) => ({ ...g, ...scheduleOn(g, shown) })).sort((a, b) => a.time.localeCompare(b.time));
  return {
    title: `Dars jadvali ${label}`,
    columns: ["Vaqt", "Guruh", "Kurs", "O'qituvchi", "Xona", "O'quvchilar"],
    rows: groups.map((g) => [
      `${g.time}–${fromMinutes(toMinutes(g.time) + lessonMinutes(g))}`, g.name, g.course.name,
      [g.teacher?.name, g.assistant?.name].filter(Boolean).join(" + ") || null, g.room?.name ?? null, g._count.students,
    ]),
  };
}
