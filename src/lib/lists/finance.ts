import "server-only";
import { db } from "../db";
import type { CurrentUser } from "../access";
import { EXPENSE_CATEGORIES } from "../format";
import { fmtDate, type Table } from "../export";

/** One year of income and expenses: the page's data, and the expense list as its export. */
export async function loadFinance(_user: CurrentUser, params: { y?: string }) {
  const year = Number(params.y) || new Date().getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const [tuition, shop, expenses] = await Promise.all([
    db.payment.findMany({ where: { date: { gte: from, lt: to } }, select: { amount: true, date: true } }),
    db.sale.findMany({ where: { date: { gte: from, lt: to } }, select: { total: true, date: true } }),
    db.expense.findMany({ where: { date: { gte: from, lt: to } }, include: { salaryPayment: true }, orderBy: { date: "desc" } }),
  ]);
  const table: Table = {
    title: `Xarajatlar ${year}`,
    columns: ["Sana", "Nomi", "Turkum", "Summa"],
    rows: expenses.map((e) => [fmtDate(e.date), e.title, EXPENSE_CATEGORIES[e.category] ?? e.category, e.amount]),
  };
  return { year, tuition, shop, expenses, table };
}
