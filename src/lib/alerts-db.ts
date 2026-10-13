import "server-only";
import { db } from "./db";
import { can, groupScope, type CurrentUser } from "./access";
import { centreDay } from "./membership-db";
import { courseEndAlerts } from "./alerts";
import { closedDaysOf } from "./holidays-db";

/** Course-end alerts for the groups this user may see (none without groups.view). */
export async function alertsFor(user: CurrentUser) {
  if (!can(user, "groups.view")) return [];
  const groups = await db.group.findMany({
    where: { status: "ACTIVE", ...groupScope(user), course: { subjects: { some: {} } } },
    select: { id: true, name: true, status: true, startDate: true, days: true, startSubjectId: true, startLevel: true, course: { select: { subjects: true } } },
  });
  const closed = await closedDaysOf();
  return courseEndAlerts(groups.map((g) => ({ ...g, holidays: closed(g.id) })), centreDay());
}
