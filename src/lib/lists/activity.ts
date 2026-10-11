import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import type { CurrentUser } from "../access";
import type { Table } from "../export";

export function activityWhere(params: { user?: string; area?: string; q?: string }): Prisma.AuditLogWhereInput {
  return {
    ...(params.user ? { userId: Number(params.user) } : {}),
    ...(params.area ? { action: { startsWith: `${params.area}.` } } : {}),
    ...(params.q ? { summary: { contains: params.q } } : {}),
  };
}

const stamp = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Every log row matching the page's filters (all pages). */
export async function activityTable(_user: CurrentUser, params: { user?: string; area?: string; q?: string }): Promise<Table> {
  const logs = await db.auditLog.findMany({ where: activityWhere(params), include: { user: true }, orderBy: { createdAt: "desc" } });
  return { title: "Faoliyat jurnali", columns: ["Vaqt", "Xodim", "Amal", "Tafsilot"], rows: logs.map((l) => [stamp(l.createdAt), l.user?.name ?? "Tizim", l.action, l.summary]) };
}
