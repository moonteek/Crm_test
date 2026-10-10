/** A calendar date as UTC midnight — membership events never carry a time of day. */
export const dayOf = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

type LegacyEvent = { type: "TRIAL" | "ACTIVATE" | "LEAVE"; date: Date };

/** Events for a membership created before statuses existed: active from joining, left on leaving. */
export function eventsFromLegacy(joinedAt: Date, leftAt: Date | null): LegacyEvent[] {
  const joined = dayOf(joinedAt);
  // left before it ever started (e.g. a future join date, then removed): the old rule charged nothing
  if (leftAt && dayOf(leftAt) < joined) return [{ type: "TRIAL", date: joined }, { type: "LEAVE", date: joined }];
  const events: LegacyEvent[] = [{ type: "ACTIVATE", date: joined }];
  if (leftAt) events.push({ type: "LEAVE", date: dayOf(leftAt) });
  return events;
}
