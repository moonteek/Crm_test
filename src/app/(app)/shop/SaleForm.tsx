"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { createSale } from "../actions";

type P = { id: number; name: string; price: number; stock: number; category: string };

const sum = (n: number) => new Intl.NumberFormat("ru-RU").format(n).replace(/ /g, " ") + " so'm";

export function SaleForm({ products, students }: { products: P[]; students: { id: number; name: string; phone: string }[] }) {
  const [state, action, pending] = useActionState(createSale, null);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [formKey, setFormKey] = useState(0);
  const total = useMemo(() => products.reduce((s, p) => s + (qty[p.id] ?? 0) * p.price, 0), [qty, products]);
  // clear the cart only after a successful sale
  useEffect(() => {
    if (state?.ok) {
      setQty({});
      setFormKey((k) => k + 1);
    }
  }, [state]);
  const set = (id: number, v: number, max: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(max, v)) }));

  return (
    <form
      key={formKey}
      action={action}
      className="space-y-4"
    >
      <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
        {products.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="text-xs text-slate-500">{sum(p.price)} · omborda {p.stock}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => set(p.id, (qty[p.id] ?? 0) - 1, p.stock)} className="btn-secondary h-8 w-8 p-0" aria-label="Kamaytirish"><Minus className="h-4 w-4" /></button>
              <input
                name={`qty_${p.id}`} type="number" min={0} max={p.stock} value={qty[p.id] ?? 0}
                onChange={(e) => set(p.id, Number(e.target.value), p.stock)}
                className="input h-8 w-14 px-1 text-center" aria-label={`${p.name} soni`}
              />
              <button type="button" onClick={() => set(p.id, (qty[p.id] ?? 0) + 1, p.stock)} disabled={(qty[p.id] ?? 0) >= p.stock} className="btn-secondary h-8 w-8 p-0" aria-label="Ko'paytirish"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        {products.length === 0 && <p className="p-4 text-center text-sm text-slate-400">Sotuvga mahsulot yo&apos;q</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Xaridor (o&apos;quvchi)</span>
          <select name="studentId" className="input" defaultValue="">
            <option value="">— O&apos;quvchi emas —</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.phone}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Yoki xaridor ismi</span>
          <input name="buyerName" className="input" placeholder="Ixtiyoriy" />
        </label>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block">
          <span className="label">To&apos;lov turi</span>
          <select name="method" className="input w-40">
            <option value="CASH">Naqd</option>
            <option value="CARD">Karta</option>
            <option value="TRANSFER">O&apos;tkazma</option>
          </select>
        </label>
        <div className="text-right">
          <p className="text-xs text-slate-500">Jami</p>
          <p className="text-2xl font-semibold">{sum(total)}</p>
        </div>
      </div>
      {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Sotuv saqlandi</p>}
      <button className="btn-primary w-full" disabled={pending || total === 0}>{pending ? "Saqlanmoqda..." : "Sotish"}</button>
    </form>
  );
}
