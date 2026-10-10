import "server-only";
import type { Prisma } from "@prisma/client";
import { applyEvent, type EventType, type Status } from "./membership";
import { dayOf, eventsFromLegacy } from "./membership-legacy";
import { centreToday } from "./schedule";

type Tx = Prisma.TransactionClient;
export type MemberEventInput = { type: EventType; date: Date; reasonId?: number | null; comment?: string | null; userId?: number | null; system?: boolean };

/** Today at the centre, as a calendar date (UTC midnight) — the default date for every action. */
export function centreDay(d = new Date()) {
  const t = centreToday(d);
  return new Date(Date.UTC(t.year, t.month - 1, t.day));
}

/**
 * The only way a membership changes: checks the step against the history, stores the event and keeps
 * GroupStudent.status / joinedAt / leftAt in sync. Throws a readable Uzbek message when the step is refused.
 */
export async function recordEvent(tx: Tx, groupStudentId: number, e: MemberEventInput): Promise<Status> {
  let gs = await tx.groupStudent.findUniqueOrThrow({
    where: { id: groupStudentId },
    include: { events: { orderBy: [{ date: "asc" }, { id: "asc" }] } },
  });
  // a row from before statuses existed (migration not run yet): give it its history first, never overwrite it
  if (!gs.events.length && gs.status !== "LEFT") {
    await tx.membershipEvent.createMany({ data: eventsFromLegacy(gs.joinedAt, gs.leftAt).map((x) => ({ ...x, groupStudentId, migrated: true })) });
    gs = await tx.groupStudent.update({
      where: { id: groupStudentId },
      data: { status: gs.leftAt ? "LEFT" : "ACTIVE" },
      include: { events: { orderBy: [{ date: "asc" }, { id: "asc" }] } },
    });
  }
  const date = dayOf(e.date);
  const events = gs.events.map((x) => ({ type: x.type as EventType, date: x.date }));
  const res = applyEvent(events, { ...e, date });
  if (!res.ok) throw new Error(res.error);

  // optimistic check: if someone else changed the status meanwhile (double click, two staff), refuse
  const updated = await tx.groupStudent.updateMany({
    where: { id: groupStudentId, status: gs.status },
    data: {
      status: res.status,
      joinedAt: events[0]?.date ?? date,
      leftAt: res.status === "LEFT" ? date : null,
    },
  });
  if (updated.count === 0) throw new Error("O'quvchi holati hozirgina o'zgardi — sahifani yangilang");
  await tx.membershipEvent.create({
    data: { groupStudentId, type: e.type, date, reasonId: e.reasonId ?? null, comment: e.comment || null, userId: e.userId ?? null },
  });
  return res.status;
}

/** Puts a student into a group (again) as trial or active; earlier history in that group is kept. */
export async function startMembership(
  tx: Tx,
  p: { groupId: number; studentId: number; mode: "TRIAL" | "ACTIVE"; date: Date; userId?: number | null },
) {
  const gs = await tx.groupStudent.upsert({
    where: { groupId_studentId: { groupId: p.groupId, studentId: p.studentId } },
    // a brand-new row has no events yet; recordEvent sets the real status
    create: { groupId: p.groupId, studentId: p.studentId, joinedAt: dayOf(p.date), status: "LEFT" },
    update: {},
  });
  await recordEvent(tx, gs.id, { type: p.mode === "TRIAL" ? "TRIAL" : "ACTIVATE", date: p.date, userId: p.userId });
  return gs.id;
}
