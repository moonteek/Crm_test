import type { BillableMembership } from "@/lib/billing";

// Plain-data shapes passed from server pages to the member menu (dates as ISO strings).
export type MemberGroup = { id: number; name: string; days: string; price: number | null; course: { name: string; price: number }; prices: { price: number; from: string }[] };
export type MemberData = {
  id: number;
  status: string;
  events: { type: string; date: string; migrated: boolean }[];
  group: MemberGroup;
  student: { id: number; name: string };
};
export type ReasonOption = { id: number; name: string };

type MembershipRow = {
  id: number;
  status: string;
  events: { type: string; date: Date; migrated: boolean }[];
  group: { id: number; name: string; days: string; price: number | null; course: { name: string; price: number }; prices: { price: number; from: Date }[] };
};

export function toMemberData(gs: MembershipRow, student: { id: number; name: string }): MemberData {
  return {
    id: gs.id,
    status: gs.status,
    events: gs.events.map((e) => ({ type: e.type, date: e.date.toISOString(), migrated: e.migrated })),
    group: toMemberGroup(gs.group),
    student,
  };
}

/** Plain-data group (dates as ISO strings) for client components. */
export function toMemberGroup(g: MembershipRow["group"]): MemberGroup {
  return {
    id: g.id, name: g.name, days: g.days, price: g.price,
    course: { name: g.course.name, price: g.course.price },
    prices: g.prices.map((p) => ({ price: p.price, from: p.from.toISOString() })),
  };
}

export function toBillable(m: Pick<MemberData, "events" | "group">): BillableMembership {
  const group = { ...m.group, prices: m.group.prices.map((p) => ({ price: p.price, from: new Date(p.from) })) };
  return { groupId: m.group.id, group, events: m.events.map((e) => ({ type: e.type, date: new Date(e.date), migrated: e.migrated })) };
}
