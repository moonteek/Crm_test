import type { BillableMembership } from "@/lib/billing";

// Plain-data shapes passed from server pages to the member menu (dates as ISO strings).
export type MemberGroup = {
  id: number; name: string; days: string; price: number | null; course: { name: string; price: number }; prices: { price: number; from: string }[];
  /** a transfer target's own closed days (holidays + its cancelled lessons), for the cost preview */
  holidays?: string[];
};
export type MemberData = {
  id: number;
  status: string;
  events: { type: string; date: string; migrated: boolean }[];
  group: MemberGroup;
  student: { id: number; name: string };
  discounts?: { from: string; to: string; amount: number }[];
  /** this membership's group's closed days (ISO), for cost previews */
  holidays: string[];
};
export type ReasonOption = { id: number; name: string };

type MembershipRow = {
  id: number;
  status: string;
  events: { type: string; date: Date; migrated: boolean }[];
  group: { id: number; name: string; days: string; price: number | null; course: { name: string; price: number }; prices: { price: number; from: Date }[] };
  discounts?: { from: Date; to: Date; amount: number }[];
};

/** `money: false` leaves the discount amounts out (they would reach the browser of staff who can't see payments). */
export function toMemberData(gs: MembershipRow, student: { id: number; name: string }, opts: { money: boolean; holidays: string[] }): MemberData {
  return {
    id: gs.id,
    status: gs.status,
    events: gs.events.map((e) => ({ type: e.type, date: e.date.toISOString(), migrated: e.migrated })),
    group: toMemberGroup(gs.group),
    student,
    holidays: opts.holidays,
    discounts: opts.money ? (gs.discounts ?? []).map((d) => ({ from: d.from.toISOString(), to: d.to.toISOString(), amount: d.amount })) : [],
  };
}

/** Plain-data group (dates as ISO strings) for client components. */
export function toMemberGroup(g: MembershipRow["group"], holidays?: string[]): MemberGroup {
  return {
    id: g.id, name: g.name, days: g.days, price: g.price, holidays,
    course: { name: g.course.name, price: g.course.price },
    prices: g.prices.map((p) => ({ price: p.price, from: p.from.toISOString() })),
  };
}

export function toBillable(m: Pick<MemberData, "events" | "group" | "discounts" | "holidays">): BillableMembership {
  const group = { ...m.group, prices: m.group.prices.map((p) => ({ price: p.price, from: new Date(p.from) })) };
  return {
    groupId: m.group.id, group,
    events: m.events.map((e) => ({ type: e.type, date: new Date(e.date), migrated: e.migrated })),
    discounts: (m.discounts ?? []).map((d) => ({ from: new Date(d.from), to: new Date(d.to), amount: d.amount })),
    holidays: m.holidays,
  };
}

/** A student joining `target` on `date`, billed by the target's own closed days (transfer preview). */
export function joinBillable(target: MemberGroup, date: Date): BillableMembership {
  return toBillable({ events: [{ type: "ACTIVATE", date: date.toISOString(), migrated: false }], group: target, holidays: target.holidays ?? [] });
}
