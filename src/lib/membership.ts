// A student's life in a group as a sequence of events; the status is the result of the last one.

export type EventType = "TRIAL" | "ACTIVATE" | "FREEZE" | "UNFREEZE" | "BACK_TO_TRIAL" | "LEAVE";
export type Status = "TRIAL" | "ACTIVE" | "FROZEN" | "LEFT";

export const MEMBER_STATUS: Record<Status, string> = {
  TRIAL: "Sinov darsida",
  ACTIVE: "Faol",
  FROZEN: "Muzlatilgan",
  LEFT: "Chiqgan",
};

export const EVENT_LABEL: Record<EventType, string> = {
  TRIAL: "Sinov darsiga qo'shildi",
  ACTIVATE: "Faollashtirildi",
  FREEZE: "Muzlatildi",
  UNFREEZE: "Muzlatishdan chiqarildi",
  BACK_TO_TRIAL: "Sinov darsiga qaytarildi",
  LEAVE: "Guruhdan chiqdi",
};

const RESULT: Record<EventType, Status> = {
  TRIAL: "TRIAL", ACTIVATE: "ACTIVE", FREEZE: "FROZEN", UNFREEZE: "ACTIVE", BACK_TO_TRIAL: "TRIAL", LEAVE: "LEFT",
};

const ALLOWED: Record<Status | "NONE", EventType[]> = {
  NONE: ["TRIAL", "ACTIVATE"],
  TRIAL: ["ACTIVATE", "LEAVE"],
  ACTIVE: ["FREEZE", "BACK_TO_TRIAL", "LEAVE"],
  FROZEN: ["UNFREEZE", "LEAVE"],
  LEFT: ["TRIAL", "ACTIVATE"],
};

const NEEDS_REASON: EventType[] = ["FREEZE", "LEAVE"];

export function statusAfter(events: { type: EventType }[]): Status | null {
  const last = events.at(-1);
  return last ? RESULT[last.type] : null;
}

export const allowedActions = (status: Status | null) => ALLOWED[status ?? "NONE"];

/**
 * What staff may do from a student's ⋯ menu. Narrower than allowedActions: activation is only for trial
 * students, and a student who left joins again through "add to group" (which asks trial or active).
 */
export const menuActions = (status: Status | null): EventType[] =>
  status === "LEFT" || status === null ? [] : allowedActions(status);

/** Date for an automatic leave (group finished): today, or the member's last step if that is later. */
export function systemLeaveDate(events: { date: Date }[], today: Date) {
  const last = events.at(-1)?.date;
  return last && last > today ? last : today;
}

/** Checks that `next` may follow `events` (oldest first) and returns the resulting status. */
export function applyEvent(
  events: { type: EventType; date: Date }[],
  next: { type: EventType; date: Date; reasonId?: number | null; system?: boolean },
): { ok: true; status: Status } | { ok: false; error: string } {
  const status = statusAfter(events);
  if (!allowedActions(status).includes(next.type)) {
    return { ok: false, error: `Bu amalni bajarib bo'lmaydi: o'quvchi holati — ${status ? MEMBER_STATUS[status].toLowerCase() : "guruhda emas"}` };
  }
  const last = events.at(-1);
  if (last && next.date < last.date) return { ok: false, error: "Sana oldingi amaldan oldin bo'lishi mumkin emas" };
  if (NEEDS_REASON.includes(next.type) && !next.reasonId && !next.system) return { ok: false, error: "Sababni tanlang" };
  return { ok: true, status: RESULT[next.type] };
}
