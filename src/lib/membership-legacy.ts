/** A calendar date as UTC midnight — membership events never carry a time of day. */
export const dayOf = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Events for a membership created before statuses existed: active from joining, left on leaving. */
export function eventsFromLegacy(joinedAt: Date, leftAt: Date | null): { type: "ACTIVATE" | "LEAVE"; date: Date }[] {
  const events: { type: "ACTIVATE" | "LEAVE"; date: Date }[] = [{ type: "ACTIVATE", date: dayOf(joinedAt) }];
  if (leftAt) events.push({ type: "LEAVE", date: dayOf(leftAt) });
  return events;
}
