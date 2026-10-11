import { EVENT_LABEL, type EventType } from "./membership";
import { PAYMENT_METHODS } from "./format";

// One timeline per student: group events and payments come from their own tables (so older history shows too);
// the activity log adds everything else (profile edits, notes, tags, deleted payments).

export type HistoryItem = { at: Date; what: string; group: string | null; amount: number | null; who: string | null };

type Input = {
  events: { date: Date; createdAt: Date; type: string; group: string; user: string | null; reason: string | null }[];
  payments: { date: Date; amount: number; group: string | null; method: string }[];
  logs: { createdAt: Date; action: string; summary: string; user: string | null }[];
};

// log actions already shown from the events / payments tables
const SHOWN_ELSEWHERE = new Set(["payment.create", "student.join", "student.transfer", ...Object.keys(EVENT_LABEL).map((t) => `student.${t.toLowerCase()}`)]);

/** `showMoney: false` (no payments access) leaves out payments and payment logs. */
export function studentHistory({ events, payments, logs }: Input, opts: { showMoney?: boolean } = {}): HistoryItem[] {
  if (opts.showMoney === false) {
    payments = [];
    logs = logs.filter((l) => !l.action.startsWith("payment."));
  }
  const items: HistoryItem[] = [
    ...events.map((e) => ({
      at: e.createdAt,
      what: `${EVENT_LABEL[e.type as EventType] ?? e.type}${e.reason ? ` · ${e.reason}` : ""}`,
      group: e.group,
      amount: null,
      who: e.user,
    })),
    // payments carry no author or creation time; their own date is the best moment we have
    ...payments.map((p) => ({ at: p.date, what: `To'lov · ${PAYMENT_METHODS[p.method] ?? p.method}`, group: p.group, amount: p.amount, who: null })),
    ...logs.filter((l) => !SHOWN_ELSEWHERE.has(l.action)).map((l) => ({ at: l.createdAt, what: l.summary, group: null, amount: null, who: l.user })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}
