import Link from "next/link";
import { ChevronLeft, ChevronRight, PackagePlus, Pencil, Plus, Trash2, ClipboardCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/access";
import { date, MONTHS, PAYMENT_METHODS, PRODUCT_CATEGORIES } from "@/lib/format";
import { currentMonth, monthBounds, shiftMonth } from "@/lib/month";
import { fmt } from "@/components/charts/format";
import { BarList } from "@/components/charts/BarList";
import { Modal } from "@/components/Modal";
import { Empty, Field, PageHeader, SubmitRow } from "@/components/ui";
import { adjustStock, deleteSale, restockProduct, saveProduct } from "../actions";
import { SaleForm } from "./SaleForm";

const LOW_STOCK = 5;
type Prod = { id: number; name: string; category: string; price: number; cost: number; stock: number; active: boolean };

function ProductFields({ p }: { p?: Prod }) {
  return (
    <>
      <Field label="Nomi"><input name="name" className="input" required defaultValue={p?.name} placeholder="Python asoslari kitobi" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Turkum">
          <select name="category" className="input" defaultValue={p?.category ?? "BOOK"}>
            {Object.entries(PRODUCT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Sotuv narxi"><input name="price" type="number" min={1} className="input" required defaultValue={p?.price} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tannarx (bitta)"><input name="cost" type="number" min={0} className="input" defaultValue={p?.cost ?? 0} /></Field>
        {p ? (
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} className="h-4 w-4 accent-ink" /> Sotuvda</label>
        ) : (
          <Field label="Boshlang'ich qoldiq"><input name="stock" type="number" min={0} className="input" defaultValue={0} /></Field>
        )}
      </div>
    </>
  );
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ tab?: string; m?: string }> }) {
  const user = await requirePage("shop.view");
  const sell = can(user, "shop.sell");
  const manage = can(user, "shop.manage");
  const { tab = "sell", m } = await searchParams;
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : currentMonth();
  const { from, to } = monthBounds(month);
  const [y, mm] = month.split("-").map(Number);

  const [products, sales, students] = await Promise.all([
    db.product.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.sale.findMany({ where: { date: { gte: from, lt: to } }, include: { items: { include: { product: true } }, student: true, user: true }, orderBy: { date: "desc" } }),
    sell ? db.student.findMany({ where: { groups: { some: { leftAt: null } } }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } }) : [],
  ]);
  const revenue = sales.reduce((s, x) => s + x.total, 0);
  const cogs = sales.flatMap((x) => x.items).reduce((s, i) => s + i.cost * i.qty, 0);
  const units = sales.flatMap((x) => x.items).reduce((s, i) => s + i.qty, 0);
  const byProduct = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const bySeller = new Map<string, number>();
  sales.forEach((s) => {
    bySeller.set(s.user?.name ?? "—", (bySeller.get(s.user?.name ?? "—") ?? 0) + s.total);
    s.items.forEach((i) => {
      byProduct.set(i.product.name, (byProduct.get(i.product.name) ?? 0) + i.qty * i.price);
      const c = PRODUCT_CATEGORIES[i.product.category];
      byCategory.set(c, (byCategory.get(c) ?? 0) + i.qty * i.price);
    });
  });
  const toItems = (mp: Map<string, number>) => [...mp].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const low = products.filter((p) => p.active && p.stock <= LOW_STOCK);
  const tabs = [
    ...(sell ? [{ key: "sell", label: "Sotish" }] : []),
    { key: "products", label: "Mahsulotlar va ombor" },
    { key: "report", label: "Hisobot" },
  ];
  const active = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;

  return (
    <>
      <PageHeader title="Do'kon" subtitle="Kitoblar, merch va boshqa mahsulotlar">
        <div className="flex items-center gap-2">
          <Link href={`/shop?tab=${active}&m=${shiftMonth(month, -1)}`} className="btn-secondary px-2"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="w-32 text-center text-sm font-medium tabular-nums">{MONTHS[mm - 1]} {y}</span>
          <Link href={`/shop?tab=${active}&m=${shiftMonth(month, 1)}`} className="btn-secondary px-2"><ChevronRight className="h-4 w-4" /></Link>
        </div>
        {manage && (
          <Modal title="Yangi mahsulot" trigger={<><Plus className="h-4 w-4" /> Mahsulot</>}>
            <form action={saveProduct.bind(null, null)} className="space-y-3"><ProductFields /><SubmitRow /></form>
          </Modal>
        )}
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-4"><p className="label-mono">Savdo</p><p className="mt-2 text-xl font-semibold">{fmt(revenue, "money")}</p></div>
        <div className="card p-4"><p className="label-mono">Yalpi foyda</p><p className="mt-2 text-xl font-semibold">{fmt(revenue - cogs, "money")}</p><p className="text-xs text-faint">savdo − tannarx</p></div>
        <div className="card p-4"><p className="label-mono">Sotilgan</p><p className="mt-2 text-xl font-semibold">{units} ta</p><p className="text-xs text-faint">{sales.length} ta xarid</p></div>
        <div className="card p-4"><p className="label-mono">Kam qolgan</p><p className={`mt-1 text-xl font-semibold ${low.length ? "text-danger" : ""}`}>{low.length} ta</p><p className="text-xs text-faint">{LOW_STOCK} tadan kam</p></div>
      </div>

      <div className="mb-6 flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <Link key={t.key} href={`/shop?tab=${t.key}&m=${month}`} className={`border-b-2 px-4 py-2.5 text-sm font-medium ${active === t.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}>{t.label}</Link>
        ))}
      </div>

      {active === "sell" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="card p-5 xl:col-span-2">
            <h2 className="mb-3 font-semibold">Yangi sotuv</h2>
            <SaleForm products={products.filter((p) => p.active && p.stock > 0)} students={students} />
          </div>
          <div className="card overflow-x-auto xl:col-span-3">
            <h2 className="px-5 py-4 font-semibold">{MONTHS[mm - 1]} savdolari</h2>
            <SalesTable sales={sales} manage={manage} />
          </div>
        </div>
      )}

      {active === "products" && (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Mahsulot</th><th>Turkum</th><th className="text-right">Narx</th><th className="text-right">Tannarx</th><th className="text-right">Ustama</th><th className="text-right">Qoldiq</th>{manage && <th></th>}</tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                  <td className="font-medium">{p.name}{!p.active && <span className="badge ml-2 bg-ink/5 text-muted">sotuvda emas</span>}</td>
                  <td>{PRODUCT_CATEGORIES[p.category]}</td>
                  <td className="text-right tabular-nums">{fmt(p.price, "money")}</td>
                  <td className="text-right tabular-nums text-muted">{fmt(p.cost, "money")}</td>
                  <td className="text-right tabular-nums">{p.cost ? `${Math.round(((p.price - p.cost) / p.price) * 100)}%` : "—"}</td>
                  <td className="text-right">
                    <span className={`badge ${p.stock === 0 ? "bg-danger-tint text-danger" : p.stock <= LOW_STOCK ? "bg-warning-tint text-warning" : "bg-ink/5 text-ink"}`}>{p.stock} ta</span>
                  </td>
                  {manage && (
                    <td>
                      <div className="flex items-center justify-end gap-3">
                        <Modal title={`Kirim — ${p.name}`} triggerClassName="text-faint hover:text-ink" trigger={<PackagePlus className="h-4 w-4" />}>
                          <form action={restockProduct.bind(null, p.id)} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Miqdor"><input name="qty" type="number" min={1} className="input" required /></Field>
                              <Field label="Tannarx (bitta)"><input name="cost" type="number" min={0} className="input" defaultValue={p.cost} /></Field>
                            </div>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="asExpense" defaultChecked className="h-4 w-4 accent-ink" /> Xarajat sifatida yozish (Tovar xaridi)</label>
                            <Field label="Izoh"><input name="note" className="input" placeholder="Yetkazib beruvchi, hujjat raqami..." /></Field>
                            <SubmitRow text="Kirim qilish" />
                          </form>
                        </Modal>
                        <Modal title={`Inventarizatsiya — ${p.name}`} triggerClassName="text-faint hover:text-ink" trigger={<ClipboardCheck className="h-4 w-4" />}>
                          <form action={adjustStock.bind(null, p.id)} className="space-y-3">
                            <p className="text-sm text-muted">Tizimda: <b>{p.stock} ta</b>. Sanab chiqilgan haqiqiy sonni kiriting.</p>
                            <Field label="Haqiqiy qoldiq"><input name="counted" type="number" min={0} className="input" required defaultValue={p.stock} /></Field>
                            <Field label="Sabab"><input name="note" className="input" placeholder="Shikastlangan, yo'qolgan..." /></Field>
                            <SubmitRow />
                          </form>
                        </Modal>
                        <Modal title="Mahsulotni tahrirlash" triggerClassName="text-faint hover:text-ink" trigger={<Pencil className="h-4 w-4" />}>
                          <form action={saveProduct.bind(null, p.id)} className="space-y-3"><ProductFields p={p} /><SubmitRow /></form>
                        </Modal>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <Empty text="Mahsulotlar yo'q" />}
        </div>
      )}

      {active === "report" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="card p-5"><h2 className="mb-3 font-semibold">Mahsulotlar bo&apos;yicha</h2><BarList format="money" items={toItems(byProduct)} /></div>
            <div className="card p-5"><h2 className="mb-3 font-semibold">Turkumlar bo&apos;yicha</h2><BarList format="money" items={toItems(byCategory)} /></div>
            <div className="card p-5"><h2 className="mb-3 font-semibold">Kim sotdi</h2><BarList format="money" items={toItems(bySeller)} /></div>
          </div>
          <div className="card overflow-x-auto">
            <h2 className="px-5 py-4 font-semibold">Barcha savdolar</h2>
            <SalesTable sales={sales} manage={manage} />
          </div>
        </div>
      )}
    </>
  );
}

type SaleRow = {
  id: number; date: Date; total: number; method: string; buyerName: string | null;
  student: { id: number; name: string } | null; user: { name: string } | null;
  items: { qty: number; product: { name: string } }[];
};

function SalesTable({ sales, manage }: { sales: SaleRow[]; manage: boolean }) {
  return (
    <>
      <table className="table">
        <thead><tr><th>Sana</th><th>Xaridor</th><th>Mahsulotlar</th><th className="text-right">Summa</th><th>Turi</th><th>Sotuvchi</th>{manage && <th></th>}</tr></thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id}>
              <td>{date(s.date)}</td>
              <td>{s.student ? <Link href={`/students/${s.student.id}`} className="font-medium hover:underline">{s.student.name}</Link> : s.buyerName ?? "—"}</td>
              <td className="whitespace-normal text-muted">{s.items.map((i) => `${i.product.name} × ${i.qty}`).join(", ")}</td>
              <td className="text-right font-semibold tabular-nums">{fmt(s.total, "money")}</td>
              <td>{PAYMENT_METHODS[s.method]}</td>
              <td className="text-muted">{s.user?.name ?? "—"}</td>
              {manage && (
                <td>
                  <form action={deleteSale.bind(null, s.id)}>
                    <button className="text-faint hover:text-danger" aria-label="Bekor qilish"><Trash2 className="h-4 w-4" /></button>
                  </form>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {sales.length === 0 && <Empty text="Bu oyda savdo yo'q" />}
    </>
  );
}
