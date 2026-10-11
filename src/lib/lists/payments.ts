import "server-only";
import { db } from "../db";
import { studentScope, type CurrentUser } from "../access";
import { MONTHS, PAYMENT_METHODS } from "../format";
import { fmtDate, type Table } from "../export";

/** Payments of one month (optionally one method): the page and its export. */
export async function loadPayments(user: CurrentUser, params: { m?: string; method?: string }) {
  const now = new Date();
  const [year, month] = params.m ? [Number(params.m.split("-")[0]), Number(params.m.split("-")[1]) - 1] : [now.getFullYear(), now.getMonth()];
  const method = params.method && params.method in PAYMENT_METHODS ? params.method : undefined;
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);
  const payments = await db.payment.findMany({
    where: { date: { gte: from, lt: to }, ...(method ? { method } : {}), student: studentScope(user) },
    include: { student: true, group: true },
    orderBy: { date: "desc" },
  });
  const table: Table = {
    title: `To'lovlar ${MONTHS[month]} ${year}`,
    columns: ["Sana", "O'quvchi", "Guruh", "Summa", "Turi", "Izoh"],
    rows: payments.map((p) => [fmtDate(p.date), p.student.name, p.group?.name ?? null, p.amount, PAYMENT_METHODS[p.method] ?? p.method, p.note]),
  };
  return { year, month, from, method, payments, table };
}
