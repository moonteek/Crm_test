"use client";

import { useEffect, useRef } from "react";
import { Download, Printer, X } from "lucide-react";

/** Chop etish / PDF yuklab olish / Yopish above the receipt (hidden on paper). `autoPrint` opens the print window once. */
export function PrintButtons({ pdfHref, autoPrint }: { pdfHref: string; autoPrint: boolean }) {
  const done = useRef(false);
  useEffect(() => {
    if (!autoPrint || done.current) return;
    done.current = true;
    window.print();
  }, [autoPrint]);
  const close = () => (window.opener || history.length <= 1 ? window.close() : history.back());
  return (
    <div className="mx-auto mb-4 flex max-w-md flex-wrap justify-center gap-2 px-4 print:hidden">
      <button type="button" className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Chop etish</button>
      <a href={pdfHref} className="btn-ghost border border-line" download><Download className="h-4 w-4" /> PDF yuklab olish</a>
      <button type="button" className="btn-ghost border border-line" onClick={close}><X className="h-4 w-4" /> Yopish</button>
    </div>
  );
}
