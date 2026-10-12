"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

type Hit = { id: number; name: string; phone: string; groups: string[]; balance: number | null };
const money = (n: number) => `${new Intl.NumberFormat("ru-RU").format(n).replace(/\s/g, " ")} so'm`;

/** Student search: the button opens it, so do Ctrl+K and "/"; arrows move, Enter opens the student. */
/** `shortcuts`: only one instance may listen for Ctrl+K and "/" (both navs are always mounted). */
export function SearchDialog({ compact = false, shortcuts = false }: { compact?: boolean; shortcuts?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.closest("input, textarea, select") || e.target.isContentEditable);
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shortcuts]);
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open]);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 0); else { setQ(""); setHits([]); } }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search/students?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        setHits(r.ok ? await r.json() : []);
        setActive(0);
      } catch {} finally { setLoading(false); }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const go = (h: Hit) => { setOpen(false); router.push(`/students/${h.id}`); };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact ? "press flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink" : "press flex h-9 items-center gap-2 rounded-full border border-line px-3 text-sm text-muted hover:text-ink"}
        aria-label="O'quvchi qidirish"
        title="O'quvchi qidirish (Ctrl+K)"
      >
        <Search className="h-4 w-4" />
        {!compact && <><span className="hidden lg:inline">Qidirish</span><kbd className="hidden font-mono text-[10px] text-faint lg:inline">Ctrl K</kbd></>}
      </button>
      {/* rendered at the end of <body>: the phone top bar's backdrop blur would trap a fixed overlay inside the bar */}
      {open && createPortal(
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/30 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
          <div role="dialog" aria-label="O'quvchi qidirish" className="w-full max-w-lg rounded-2xl border border-line bg-surface shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="h-4 w-4 shrink-0 text-faint" />
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                  if (e.key === "Enter" && hits[active]) go(hits[active]);
                }}
                placeholder="Ism yoki telefon raqam…"
                className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint"
                aria-label="Qidirish"
              />
              <button type="button" onClick={() => setOpen(false)} className="text-faint hover:text-ink" aria-label="Yopish"><X className="h-4 w-4" /></button>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {q.trim().length < 2 && <li className="px-3 py-6 text-center text-sm text-muted">Kamida 2 ta harf yoki raqam yozing</li>}
              {q.trim().length >= 2 && !loading && hits.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Hech narsa topilmadi</li>}
              {hits.map((h, i) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left ${i === active ? "bg-ink/5" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{h.name}</span>
                      <span className="block truncate text-xs text-muted">{h.phone}{h.groups.length ? ` · ${h.groups.join(", ")}` : " · guruhsiz"}</span>
                    </span>
                    {h.balance !== null && (
                      <span className={`badge shrink-0 ${h.balance < 0 ? "bg-danger-tint text-danger" : "bg-ink/5 text-muted"}`}>{money(h.balance)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
