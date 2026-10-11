import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { can, leadScope, type CurrentUser } from "../access";
import { LEAD_STATUSES } from "../format";
import { fmtDate, type Table } from "../export";

/** The leads the page shows: open ones plus anything from the last 60 days, with the seller and source filters. */
export function leadsWhere(user: CurrentUser, params: { u?: string; src?: string }): Prisma.LeadWhereInput {
  const own = can(user, "leads.own");
  return {
    ...leadScope(user),
    ...(!own && params.u ? { assignedToId: params.u === "none" ? null : Number(params.u) } : {}),
    ...(params.src ? { source: params.src } : {}),
    OR: [{ status: { in: ["NEW", "CONTACTED", "TRIAL"] } }, { createdAt: { gte: new Date(Date.now() - 60 * 86400_000) } }],
  };
}

export async function leadsTable(user: CurrentUser, params: { u?: string; src?: string }): Promise<Table> {
  const leads = await db.lead.findMany({ where: leadsWhere(user, params), include: { course: true, assignedTo: true }, orderBy: { createdAt: "desc" } });
  const status = (k: string) => LEAD_STATUSES.find((s) => s.key === k)?.label ?? k;
  return {
    title: "Lidlar",
    columns: ["Ism", "Telefon", "Holati", "Kurs", "Manba", "Mas'ul", "Keyingi qadam", "Yaratilgan", "Izoh"],
    rows: leads.map((l) => [l.name, l.phone, status(l.status), l.course?.name ?? null, l.source, l.assignedTo?.name ?? null, fmtDate(l.nextActionAt), fmtDate(l.createdAt), l.note]),
  };
}
