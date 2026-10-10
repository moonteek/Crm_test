import type { BillableMembership } from "@/lib/billing";

// Plain-data shapes passed from server pages to the member menu (dates as ISO strings).
export type MemberGroup = { id: number; name: string; days: string; price: number | null; course: { name: string; price: number } };
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
  group: { id: number; name: string; days: string; price: number | null; course: { name: string; price: number } };
};

export function toMemberData(gs: MembershipRow, student: { id: number; name: string }): MemberData {
  return {
    id: gs.id,
    status: gs.status,
    events: gs.events.map((e) => ({ type: e.type, date: e.date.toISOString(), migrated: e.migrated })),
    group: { id: gs.group.id, name: gs.group.name, days: gs.group.days, price: gs.group.price, course: { name: gs.group.course.name, price: gs.group.course.price } },
    student,
  };
}

export function toBillable(m: Pick<MemberData, "events" | "group">): BillableMembership {
  return { groupId: m.group.id, group: m.group, events: m.events.map((e) => ({ type: e.type, date: new Date(e.date), migrated: e.migrated })) };
}
