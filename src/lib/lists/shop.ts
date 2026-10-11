import "server-only";
import { db } from "../db";
import type { CurrentUser } from "../access";
import { MONTHS, PAYMENT_METHODS, PRODUCT_CATEGORIES } from "../format";
import { currentMonth, monthBounds } from "../month";
import { fmtDate, type Table } from "../export";

/** Shop data for one month; the export is the products list on the products tab, else the month's sales. */
export async function loadShop(_user: CurrentUser, params: { m?: string; tab?: string }, opts: { students?: boolean } = {}) {
  const month = params.m && /^\d{4}-\d{2}$/.test(params.m) ? params.m : currentMonth();
  const { from, to } = monthBounds(month);
  const [y, mm] = month.split("-").map(Number);
  const [products, sales, students] = await Promise.all([
    db.product.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.sale.findMany({ where: { date: { gte: from, lt: to } }, include: { items: { include: { product: true } }, student: true, user: true }, orderBy: { date: "desc" } }),
    opts.students ? db.student.findMany({ where: { groups: { some: { leftAt: null } } }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } }) : [],
  ]);
  const table: Table = params.tab === "products"
    ? {
        title: "Mahsulotlar",
        columns: ["Mahsulot", "Turkum", "Narx", "Tannarx", "Qoldiq", "Sotuvda"],
        rows: products.map((p) => [p.name, PRODUCT_CATEGORIES[p.category] ?? p.category, p.price, p.cost, p.stock, p.active ? "ha" : "yo'q"]),
      }
    : {
        title: `Sotuvlar ${MONTHS[mm - 1]} ${y}`,
        columns: ["Sana", "Xaridor", "Mahsulotlar", "Summa", "Turi", "Sotuvchi"],
        rows: sales.map((s) => [fmtDate(s.date), s.student?.name ?? s.buyerName, s.items.map((i) => `${i.product.name} × ${i.qty}`).join(", "), s.total, PAYMENT_METHODS[s.method] ?? s.method, s.user?.name ?? null]),
      };
  return { month, from, to, y, mm, products, sales, students, table };
}
