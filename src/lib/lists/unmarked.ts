import "server-only";
import { db } from "../db";
import { groupScope, type CurrentUser } from "../access";
import { unmarkedToday } from "../attendance";
import { closedDaysOf, holidayDays } from "../holidays-db";
import { centreDay } from "../membership-db";

/** Groups (within the user's scope) whose lesson today has started and that have no attendance mark yet. */
export async function loadUnmarkedToday(user: CurrentUser) {
  const [groups, marked, holidays, closed, makeups] = await Promise.all([
    db.group.findMany({ where: { status: "ACTIVE", ...groupScope(user) }, select: {
      id: true, name: true, days: true, time: true, status: true, startDate: true, teacher: { select: { name: true } },
      _count: { select: { students: { where: { leftAt: null, status: { in: ["ACTIVE", "TRIAL"] } } } } },
    } }),
    db.attendance.findMany({ where: { date: centreDay() }, select: { groupId: true }, distinct: ["groupId"] }),
    holidayDays(),
    closedDaysOf(),
    db.lessonChange.findMany({ where: { kind: "CANCEL", makeupDate: centreDay() }, select: { groupId: true, makeupTime: true } }),
  ]);
  // a lesson cancelled today isn't waiting for attendance
  const today = centreDay().toISOString().slice(0, 10);
  // a lesson moved to today counts at its own time, even off the group's usual days
  const moved = new Map(makeups.map((m) => [m.groupId, m.makeupTime]));
  const open = groups
    .filter((g) => moved.has(g.id) || !closed(g.id).includes(today))
    .map((g) => (moved.has(g.id) ? { ...g, time: moved.get(g.id) ?? g.time, makeupToday: true } : g));
  const ids = new Set(unmarkedToday(open.map((g) => ({ ...g, members: g._count.students })), new Set(marked.map((m) => m.groupId)), new Date(), holidays));
  return open.filter((g) => ids.has(g.id)).sort((a, b) => a.time.localeCompare(b.time));
}
