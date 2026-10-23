import "server-only";
import { db } from "./db";
import { ForbiddenError, groupScope, type CurrentUser } from "./access";
import { coverAllowed } from "./lesson-changes";
import { centreDay } from "./membership-db";
import { scheduleOn } from "./group-schedule";

/** Whether the user covers that group's lesson on `day` (a substitute or the make-up teacher) — only on the day itself. */
export async function canCover(user: CurrentUser, groupId: number, day: string) {
  const today = centreDay().toISOString().slice(0, 10);
  if (day !== today) return false;
  const date = new Date(day + "T00:00:00Z");
  const [subs, makeups] = await Promise.all([
    db.lessonChange.findMany({ where: { kind: "SUBSTITUTE", groupId, date, substituteId: user.id }, select: { groupId: true, date: true, substituteId: true } }),
    db.lessonChange.findMany({
      where: { kind: "CANCEL", groupId, makeupDate: date, makeupTeacherId: user.id },
      select: { groupId: true, date: true, charged: true, makeupDate: true, makeupTime: true, makeupRoomId: true, makeupTeacherId: true },
    }),
  ]);
  return coverAllowed({ userId: user.id, groupId, day, today, subs, makeups });
}

/**
 * Marking attendance or grades: the group's own staff (as before), or whoever covers that one lesson on its day.
 * The permission (attendance.mark / grades.manage) is still checked by the caller.
 */
export async function assertMarkAccess(user: CurrentUser, groupId: number, day: string) {
  if (await db.group.count({ where: { id: groupId, ...groupScope(user) } })) return;
  if (await canCover(user, groupId, day)) return;
  throw new ForbiddenError();
}

/** Today's lessons the user covers in someone else's group (Bosh sahifa "O'rinbosar darslaringiz"). */
export async function coveredToday(user: CurrentUser) {
  const date = centreDay();
  const [subs, makeups] = await Promise.all([
    db.lessonChange.findMany({ where: { kind: "SUBSTITUTE", date, substituteId: user.id }, include: { group: { include: { room: true, schedules: true } } } }),
    db.lessonChange.findMany({ where: { kind: "CANCEL", makeupDate: date, makeupTeacherId: user.id }, include: { group: { include: { schedules: true } }, makeupRoom: true } }),
  ]);
  return [
    ...subs.map((s) => ({ groupId: s.groupId, name: s.group.name, time: scheduleOn(s.group, date).time, room: s.group.room?.name ?? null, makeup: false })),
    ...makeups.map((m) => ({ groupId: m.groupId, name: m.group.name, time: m.makeupTime ?? scheduleOn(m.group, m.date).time, room: m.makeupRoom?.name ?? null, makeup: true })),
  ].sort((a, b) => a.time.localeCompare(b.time));
}
