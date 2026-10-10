import { chargeLines, type BillableMembership } from "./billing";
import { MONTHS, PAYMENT_METHODS } from "./format";
import { EVENT_LABEL, type EventType } from "./membership";

export type StatementMembership = BillableMembership & {
  events: { type: EventType | string; date: Date; reason?: { name: string } | null; comment?: string | null }[];
};

export type StatementRow = {
  date: Date;
  kind: "payment" | "charge" | "event";
  label: string;
  groupName?: string;
  lessons?: string;
  /** signed: payments +, charges −, events 0 */
  amount: number;
  /** balance after this row */
  balance: number;
  paymentId?: number;
};

// same-day order, oldest first: what happened, then what it cost, then what was paid
const ORDER = { event: 0, charge: 1, payment: 2 };

/** Payments, monthly charges and status changes in one list, newest first, with a running balance. */
export function statement(
  memberships: StatementMembership[],
  payments: { id: number; amount: number; method: string; date: Date; note: string | null; groupId: number | null }[],
  now = new Date(),
): StatementRow[] {
  const rows: Omit<StatementRow, "balance">[] = [];
  for (const m of memberships) {
    for (const e of m.events) {
      const extra = [e.reason?.name, e.comment].filter(Boolean).join(" · ");
      rows.push({ date: e.date, kind: "event", label: [EVENT_LABEL[e.type as EventType] ?? e.type, extra].filter(Boolean).join(" · "), groupName: m.group.name, amount: 0 });
    }
    for (const l of chargeLines(m, now)) {
      rows.push({
        date: new Date(Date.UTC(l.year, l.month, 1)),
        kind: "charge",
        label: `${MONTHS[l.month]} ${l.year}`,
        groupName: m.group.name,
        lessons: l.legacy ? "to'liq oy" : `${l.billable}/${l.lessons} dars`,
        amount: -l.amount,
      });
    }
  }
  const groupName = new Map(memberships.map((m) => [m.groupId, m.group.name]));
  for (const p of payments) {
    rows.push({
      date: p.date,
      kind: "payment",
      paymentId: p.id,
      label: ["To'lov", PAYMENT_METHODS[p.method] ?? p.method, p.note].filter(Boolean).join(" · "),
      groupName: p.groupId ? groupName.get(p.groupId) : undefined,
      amount: p.amount,
    });
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime() || ORDER[a.kind] - ORDER[b.kind]);
  let running = 0;
  return rows.map((r) => ({ ...r, balance: (running += r.amount) })).reverse();
}
