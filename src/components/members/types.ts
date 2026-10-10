import type { BillableMembership } from "@/lib/billing";

// Plain-data shapes passed from server pages to the member menu (dates as ISO strings).
export type MemberGroup = { id: number; name: string; days: string; course: { name: string; price: number } };
export type MemberData = {
  id: number;
  status: string;
  events: { type: string; date: string }[];
  group: MemberGroup;
  student: { id: number; name: string };
};
export type ReasonOption = { id: number; name: string };

type MembershipRow = {
  id: number;
  status: string;
  events: { type: string; date: Date }[];
  group: { id: number; name: string; days: string; course: { name: string; price: number } };
};

export function toMemberData(gs: MembershipRow, student: { id: number; name: string }): MemberData {
  return {
    id: gs.id,
    status: gs.status,
    events: gs.events.map((e) => ({ type: e.type, date: e.date.toISOString() })),
    group: { id: gs.group.id, name: gs.group.name, days: gs.group.days, course: { name: gs.group.course.name, price: gs.group.course.price } },
    student,
  };
}

export function toBillable(m: Pick<MemberData, "events" | "group">): BillableMembership {
  return { groupId: m.group.id, group: m.group, events: m.events.map((e) => ({ type: e.type, date: new Date(e.date) })) };
}
