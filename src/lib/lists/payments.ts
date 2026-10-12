import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { studentScope, type CurrentUser } from "../access";
import { MONTHS, PAYMENT_METHODS } from "../format";
import { editDiff, parsePaymentFilters, type PaymentFilters, type PaymentSnapshot } from "../payments";
import { fmtDate, type Table } from "../export";

const monthLabel = (d: Date | null) => (d ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : null);

function paymentWhere(f: PaymentFilters, user: CurrentUser): Prisma.PaymentWhereInput {
  const end = new Date(f.to.getTime() + 86_400_000); // the "to" day is included
  return {
    date: { gte: f.from, lt: end },
    student: { AND: [studentScope(user), f.q ? { name: { contains: f.q } } : {}] },
    ...(f.method ? { method: f.method } : {}),
    ...(f.groupId ? { groupId: f.groupId } : {}),
    ...(f.userId ? { userId: f.userId } : {}),
    ...(f.teacherId ? { group: { OR: [{ teacherId: f.teacherId }, { assistantId: f.teacherId }] } } : {}),
  };
}

/** Payments matching the list's filters (dates, student, group, teacher, Hodim, method): the page and its export. */
export async function loadPayments(user: CurrentUser, params: Record<string, string | undefined>) {
  const f = parsePaymentFilters(params, new Date());
  const payments = await db.payment.findMany({
    where: paymentWhere(f, user),
    include: {
      student: true,
      group: true,
      user: { select: { name: true } },
      edits: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  const rows = payments.map((p) => ({
    ...p,
    history: p.edits
      .map((e) => ({ at: e.createdAt, who: e.user?.name ?? "—", text: editDiff(JSON.parse(e.before) as PaymentSnapshot, JSON.parse(e.after) as PaymentSnapshot) }))
      .filter((e) => e.text),
  }));
  const table: Table = {
    title: `To'lovlar ${fmtDate(f.from)}–${fmtDate(f.to)}`,
    columns: ["Sana", "O'quvchi", "Guruh", "Summa", "Turi", "Qaysi oy", "Hodim", "Izoh"],
    rows: rows.map((p) => [fmtDate(p.date), p.student.name, p.group?.name ?? null, p.amount, PAYMENT_METHODS[p.method] ?? p.method, monthLabel(p.month), p.user?.name ?? null, p.note]),
  };
  return { filters: f, payments: rows, total: rows.reduce((s, p) => s + p.amount, 0), table };
}
