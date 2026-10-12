import "server-only";
import { db } from "../db";
import { groupScope, type CurrentUser } from "../access";
import { unmarkedToday } from "../attendance";
import { holidayDays } from "../holidays-db";
import { centreDay } from "../membership-db";

/** Groups (within the user's scope) whose lesson today has started and that have no attendance mark yet. */
export async function loadUnmarkedToday(user: CurrentUser) {
  const [groups, marked, holidays] = await Promise.all([
    db.group.findMany({ where: { status: "ACTIVE", ...groupScope(user) }, select: {
      id: true, name: true, days: true, time: true, status: true, startDate: true, teacher: { select: { name: true } },
      _count: { select: { students: { where: { leftAt: null, status: { in: ["ACTIVE", "TRIAL"] } } } } },
    } }),
    db.attendance.findMany({ where: { date: centreDay() }, select: { groupId: true }, distinct: ["groupId"] }),
    holidayDays(),
  ]);
  const ids = new Set(unmarkedToday(groups.map((g) => ({ ...g, members: g._count.students })), new Set(marked.map((m) => m.groupId)), new Date(), holidays));
  return groups.filter((g) => ids.has(g.id)).sort((a, b) => a.time.localeCompare(b.time));
}
