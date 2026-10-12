import "server-only";
import { db } from "../db";
import { groupScope, type CurrentUser } from "../access";
import { centreDay } from "../membership-db";
import { holidayDays } from "../holidays-db";
import { centreWeekday, fromMinutes, scheduleKeysOn, toMinutes, WEEKDAYS } from "../schedule";
import type { Table } from "../export";

/** One weekday of the timetable (as the page shows it, Monday on Sundays) for Excel / Google Sheets. */
export async function scheduleTable(user: CurrentUser, params: { d?: string }): Promise<Table> {
  const today = centreWeekday();
  const picked = Number(params.d);
  const day = WEEKDAYS.some((w) => w.day === picked) ? picked : today === 0 ? 1 : today;
  const label = WEEKDAYS.find((w) => w.day === day)!.label;
  // the shown weekday's date this week (Monday first; on Sunday, the coming week) — a holiday has no lessons
  const shown = new Date(centreDay().getTime() + (((day + 6) % 7) - ((today + 6) % 7) + (today === 0 ? 7 : 0)) * 86_400_000);
  const closed = (await holidayDays()).includes(shown.toISOString().slice(0, 10));
  const groups = closed ? [] : await db.group.findMany({
    where: { status: "ACTIVE", days: { in: scheduleKeysOn(day) }, ...groupScope(user) },
    include: { course: true, teacher: true, assistant: true, room: true, _count: { select: { students: { where: { leftAt: null } } } } },
    orderBy: { time: "asc" },
  });
  return {
    title: `Dars jadvali ${label}`,
    columns: ["Vaqt", "Guruh", "Kurs", "O'qituvchi", "Xona", "O'quvchilar"],
    rows: groups.map((g) => [
      `${g.time}–${fromMinutes(toMinutes(g.time) + g.course.lessonMin)}`, g.name, g.course.name,
      [g.teacher?.name, g.assistant?.name].filter(Boolean).join(" + ") || null, g.room?.name ?? null, g._count.students,
    ]),
  };
}
