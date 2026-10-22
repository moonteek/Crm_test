import { chargeLines, type BillableMembership } from "./billing";
import { money, MONTHS, PAYMENT_METHODS } from "./format";
import { EVENT_LABEL, type EventType } from "./membership";

type Who = { name: string } | null;

export type StatementMembership = BillableMembership & {
  events: { type: EventType | string; date: Date; reason?: { name: string } | null; comment?: string | null; user?: Who; createdAt?: Date }[];
};

export type StatementRow = {
  date: Date;
  kind: "payment" | "charge" | "event";
  /** the row's first word: "To'lov", "Oylik hisob", or what happened ("Faollashtirildi", "Boshqa guruhga o'tkazildi") */
  type: string;
  /** details after the type: payment method, month, reason / comment */
  label: string;
  /** who recorded it ("Tizim" for monthly charges) and when */
  who: string | null;
  at: Date | null;
  /** a payment's note, shown on its own line */
  note: string | null;
  method: string | null;
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
  payments: { id: number; amount: number; method: string; date: Date; note: string | null; groupId: number | null; user?: Who; createdAt?: Date }[],
  now = new Date(),
): StatementRow[] {
  const rows: Omit<StatementRow, "balance">[] = [];
  // a transfer = leaving one group and starting in another on the same day
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const leaves = memberships.flatMap((m) => (m.events as StatementMembership["events"]).filter((e) => e.type === "LEAVE").map((e) => ({ groupId: m.groupId, day: day(e.date), comment: e.comment ?? null })));
  const starts = memberships.flatMap((m) => m.events.filter((e) => e.type === "ACTIVATE" || e.type === "TRIAL").map((e) => ({ groupId: m.groupId, day: day(e.date) })));
  for (const m of memberships) {
    for (const e of m.events) {
      const extra = [e.reason?.name, e.comment].filter(Boolean).join(" · ");
      const movedOut = e.type === "LEAVE" && starts.some((x) => x.groupId !== m.groupId && x.day === day(e.date));
      // the app's transfer names the new group on the leave ("PY-07 guruhiga o'tkazildi"): another join that day is not part of it
      const movedIn = (e.type === "ACTIVATE" || e.type === "TRIAL")
        && leaves.some((x) => x.groupId !== m.groupId && x.day === day(e.date) && (!x.comment || x.comment === `${m.group.name} guruhiga o'tkazildi`));
      const type = movedOut ? "Boshqa guruhga o'tkazildi" : movedIn ? "O'tkazma bilan qo'shildi" : EVENT_LABEL[e.type as EventType] ?? e.type;
      rows.push({ date: e.date, kind: "event", type, label: extra, groupName: m.group.name, amount: 0, who: e.user?.name ?? null, at: e.createdAt ?? null, note: null, method: null });
    }
    for (const l of chargeLines(m, now)) {
      rows.push({
        date: new Date(Date.UTC(l.year, l.month, 1)),
        kind: "charge",
        type: "Oylik hisob",
        label: `${MONTHS[l.month]} ${l.year}`,
        who: "Tizim",
        at: null,
        note: null,
        method: null,
        groupName: m.group.name,
        lessons: (l.legacy ? "to'liq oy" : `${l.billable}/${l.lessons} dars`) + (l.discount > 0 ? ` · chegirma −${money(l.discount)}` : ""),
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
      type: "To'lov",
      label: PAYMENT_METHODS[p.method] ?? p.method,
      who: p.user?.name ?? null,
      at: p.createdAt ?? null,
      note: p.note,
      method: p.method,
      groupName: p.groupId ? groupName.get(p.groupId) : undefined,
      amount: p.amount,
    });
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime() || ORDER[a.kind] - ORDER[b.kind]);
  let running = 0;
  return rows.map((r) => ({ ...r, balance: (running += r.amount) })).reverse();
}

/** The payments tab filter: Hammasi · To'lovlar · Naqd / Karta / O'tkazma · Hisoblar · Amallar. Balances stay as computed. */
export function filterLedger(rows: StatementRow[], key: string): StatementRow[] {
  if (key === "payments") return rows.filter((r) => r.kind === "payment");
  if (key === "charges") return rows.filter((r) => r.kind === "charge");
  if (key === "events") return rows.filter((r) => r.kind === "event");
  if (key in PAYMENT_METHODS) return rows.filter((r) => r.kind === "payment" && r.method === key);
  return rows;
}
