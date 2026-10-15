"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Printer, X } from "lucide-react";
import { money } from "@/lib/format";

const EVENT = "payment-saved";
type Saved = { paymentId: number; amount: number };

/** Tells the app a payment was saved, so it can offer its receipt (works even if the form's row disappears). */
export const announcePayment = (saved: Saved) => window.dispatchEvent(new CustomEvent<Saved>(EVENT, { detail: saved }));

/**
 * "To'lov saqlandi — Chek chiqarish / PDF yuklab olish" after any payment. Lives in the app layout, not in the payment
 * dialog: on the debtors page a full payment removes the student's row (and its dialog) as the page refreshes.
 */
export function ReceiptOffer() {
  const [saved, setSaved] = useState<Saved | null>(null);
  useEffect(() => {
    const on = (e: Event) => setSaved((e as CustomEvent<Saved>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  if (!saved) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-2xl border border-line bg-raised p-3 shadow-xl md:bottom-6 md:ml-auto md:mr-6"
    >
      <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
      <p className="min-w-0 flex-1 text-sm font-medium">To&apos;lov saqlandi — {money(saved.amount)}</p>
      <a href={`/payments/${saved.paymentId}/receipt?print=1`} target="_blank" rel="noopener" className="btn-primary py-1.5" onClick={() => setSaved(null)}>
        <Printer className="h-4 w-4" /> Chek chiqarish
      </a>
      <a href={`/payments/${saved.paymentId}/receipt/pdf`} download className="btn-ghost border border-line py-1.5" onClick={() => setSaved(null)}>
        <Download className="h-4 w-4" /> PDF
      </a>
      <button type="button" className="btn-ghost px-2" aria-label="Yopish" onClick={() => setSaved(null)}><X className="h-4 w-4" /></button>
    </div>
  );
}
