"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, FileSpreadsheet } from "lucide-react";

/**
 * "Excel" downloads exactly what the list shows (its current filters, all pages);
 * "Google Sheets" copies the same table so it pastes into a sheet with Ctrl+V.
 */
export function ExportButtons({ href, extra = {} }: { href: string; extra?: Record<string, string> }) {
  const params = useSearchParams();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const url = (format: string) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    q.set("format", format);
    return `${href}?${q}`;
  };
  const show = (m: { ok: boolean; text: string }) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 4000);
  };

  const copy = async () => {
    const text = fetch(url("tsv")).then(async (r) => {
      if (!r.ok) throw new Error(await r.text());
      return r.text();
    });
    try {
      await writeClipboard(text);
      show({ ok: true, text: "Nusxa olindi — Google Sheets'da Ctrl+V bosing" });
    } catch (e) {
      const server = await text.then(() => null, (err: Error) => err.message);
      show({ ok: false, text: server ?? "Brauzer nusxa olishga ruxsat bermadi — Excel faylini yuklab oling" });
    }
  };

  return (
    <div className="relative flex gap-2">
      <a href={url("xlsx")} className="btn-secondary px-3" download>
        <FileSpreadsheet className="h-4 w-4" /> Excel
      </a>
      <button type="button" onClick={copy} className="btn-secondary px-3">
        <Copy className="h-4 w-4" /> Google Sheets
      </button>
      {message && (
        <p role="status" className={`absolute top-full right-0 z-20 mt-2 w-64 rounded-xl px-3 py-2 text-sm shadow-lg ${message.ok ? "bg-success-tint text-success" : "bg-danger-tint text-danger"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

/** Tries the ways browsers allow, newest first; throws if none works. */
async function writeClipboard(text: Promise<string>) {
  // Safari only allows a clipboard write started inside the click, so it gets the pending text
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })) })]);
      return;
    } catch {}
  }
  const value = await text;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {}
  }
  // older browsers and embedded views: copy from a hidden text box
  const box = document.createElement("textarea");
  box.value = value;
  box.style.cssText = "position:fixed;opacity:0;pointer-events:none";
  document.body.appendChild(box);
  box.select();
  const ok = document.execCommand("copy");
  box.remove();
  if (!ok) throw new Error("copy refused");
}
