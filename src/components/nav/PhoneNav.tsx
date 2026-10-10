"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { logout } from "@/app/login/actions";
import { allowedNav, isActive, phoneTabs } from "@/lib/nav";
import type { Theme } from "@/lib/theme";
import { LogoMark } from "../brand/Logo";
import { ThemeToggle } from "../ThemeToggle";

type Props = { name: string; roleName: string; permissions: string[]; theme: Theme };

/** Phones: a slim top bar, a floating pill tab bar, and a bottom sheet with the full menu. */
export function PhoneNav({ name, roleName, permissions, theme }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = allowedNav(permissions);
  const tabs = phoneTabs(permissions);
  const current = items.find((n) => isActive(n.href, pathname));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-page/85 px-4 backdrop-blur-md">
        <Link href="/" aria-label="Bosh sahifa"><LogoMark className="h-6 w-auto" /></Link>
        <span className="truncate font-semibold">{current?.label ?? "Algoritm"}</span>
      </header>

      <nav
        aria-label="Asosiy"
        className="fixed inset-x-3 z-30 flex items-center justify-around rounded-full border border-line bg-raised/90 p-1.5 backdrop-blur-md"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`press flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10.5px] font-medium ${
                active ? "bg-nav-active text-nav-active-ink" : "text-muted"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="max-w-full truncate px-1">{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="press flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10.5px] font-medium text-muted"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
          Menyu
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 animate-fade bg-black/50" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menyu"
            className="absolute inset-x-0 bottom-0 flex max-h-[85vh] animate-sheet flex-col rounded-t-3xl border-t border-line bg-surface"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong" />
            <div className="flex items-center gap-3 px-5 pt-3 pb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-on-accent">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{name}</p>
                <p className="label-mono truncate">{roleName}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-2" aria-label="Yopish">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 overflow-y-auto px-4">
              {items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href, pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`press flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center text-xs font-medium ${
                      active ? "border-transparent bg-nav-active text-nav-active-ink" : "border-line bg-raised"
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                    <span className="line-clamp-2">{label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="flex items-center gap-3 border-t border-line px-4 py-3 mt-4">
              <div className="flex-1"><ThemeToggle initial={theme} /></div>
              <form action={logout}>
                <button className="btn-secondary"><LogOut className="h-4 w-4" /> Chiqish</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
