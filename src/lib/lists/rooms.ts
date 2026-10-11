import "server-only";
import { db } from "../db";
import type { CurrentUser } from "../access";
import { GROUP_DAYS } from "../format";
import type { Table } from "../export";

export async function roomsTable(_user: CurrentUser, _params: Record<string, string> = {}): Promise<Table> {
  const rooms = await db.room.findMany({ include: { groups: { where: { status: "ACTIVE" }, orderBy: { time: "asc" } } }, orderBy: { name: "asc" } });
  return {
    title: "Xonalar",
    columns: ["Xona", "Sig'imi", "Guruhlar"],
    rows: rooms.map((r) => [r.name, r.capacity, r.groups.map((g) => `${g.name} (${GROUP_DAYS[g.days] ?? g.days} ${g.time})`).join(", ")]),
  };
}
