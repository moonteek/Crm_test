"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { allowedNav, isActive } from "@/lib/nav";
import type { Theme } from "@/lib/theme";
import { Logo, LogoMark } from "./brand/Logo";
import { ThemeToggle } from "./ThemeToggle";
import { PhoneNav } from "./nav/PhoneNav";

type Props = { name: string; roleName: string; permissions: string[]; theme: Theme };

/** Desktop sidebar (icon rail on tablets) plus the phone navigation. */
export function Sidebar({ name, roleName, permissions, theme }: Props) {
  const pathname = usePathname();
  const items = allowedNav(permissions);

  return (
    <>
      <PhoneNav name={name} roleName={roleName} permissions={permissions} theme={theme} />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col border-r border-line bg-nav md:flex lg:w-64">
        <Link href="/" className="flex h-16 items-center justify-center px-5 lg:justify-start">
          <LogoMark className="h-7 w-auto lg:hidden" />
          <Logo className="hidden lg:inline-flex" />
        </Link>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-current={active ? "page" : undefined}
                className={`press flex items-center justify-center gap-3 rounded-full px-3 py-2 text-sm font-medium lg:justify-start ${
                  active ? "bg-nav-active text-nav-active-ink" : "text-muted hover:bg-ink/5 hover:text-ink"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                <span className="hidden truncate lg:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-line p-3">
          <div className="flex items-center justify-center gap-3 lg:justify-start">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-on-accent">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="label-mono truncate">{roleName}</p>
            </div>
          </div>
          <div className="flex justify-center lg:hidden">
            <ThemeToggle initial={theme} compact />
          </div>
          <div className="hidden lg:block">
            <ThemeToggle initial={theme} />
          </div>
          <form action={logout}>
            <button className="btn-ghost w-full justify-center lg:justify-start" title="Chiqish">
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">Chiqish</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
