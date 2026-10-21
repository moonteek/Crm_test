import "server-only";
import { db } from "./db";
import { can, groupScope, type CurrentUser } from "./access";
import { centreDay } from "./membership-db";
import { courseEndAlerts } from "./alerts";
import { closedDaysOf, makeupDaysOf } from "./holidays-db";

/** Course-end alerts for the groups this user may see (none without groups.view). */
export async function alertsFor(user: CurrentUser) {
  if (!can(user, "groups.view")) return [];
  const groups = await db.group.findMany({
    where: { status: "ACTIVE", ...groupScope(user), section: { subjects: { some: {} } } },
    select: { id: true, name: true, status: true, startDate: true, days: true, startSubjectId: true, startLevel: true, section: { select: { subjects: true } } },
  });
  const closed = await closedDaysOf();
  const makeups = await makeupDaysOf();
  return courseEndAlerts(groups.map((g) => ({ ...g, holidays: closed(g.id), extraDays: makeups(g.id) })), centreDay());
}
