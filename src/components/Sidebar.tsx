"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen, DoorOpen, LayoutDashboard, LogOut, Menu, Settings, UserPlus,
  Users, UsersRound, Wallet, X, GraduationCap, Receipt, AlertCircle,
} from "lucide-react";
import { logout } from "@/app/login/actions";

const NAV = [
  { href: "/", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/leads", label: "Lidlar", icon: UserPlus },
  { href: "/students", label: "O'quvchilar", icon: Users },
  { href: "/groups", label: "Guruhlar", icon: UsersRound },
  { href: "/teachers", label: "O'qituvchilar", icon: GraduationCap },
  { href: "/courses", label: "Kurslar", icon: BookOpen },
  { href: "/payments", label: "To'lovlar", icon: Wallet },
  { href: "/debtors", label: "Qarzdorlar", icon: AlertCircle },
  { href: "/finance", label: "Moliya", icon: Receipt },
  { href: "/rooms", label: "Xonalar", icon: DoorOpen },
  { href: "/settings", label: "Sozlamalar", icon: Settings, admin: true },
];

export function Sidebar({ name, role, roleLabel }: { name: string; role: string; roleLabel: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => !n.admin || role === "ADMIN");

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 text-white lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} aria-label="Menyu">
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-slate-300 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Logo />
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active ? "bg-brand-600 text-white" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-semibold text-white">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{name}</p>
              <p className="text-xs text-slate-400">{roleLabel}</p>
            </div>
          </div>
          <form action={logout}>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/5 hover:text-white">
              <LogOut className="h-4 w-4" /> Chiqish
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">A</div>
      <span className="text-lg font-bold text-white">Algoritm</span>
    </div>
  );
}
