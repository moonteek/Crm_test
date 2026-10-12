"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { isActive, navSections } from "@/lib/nav";
import type { Theme } from "@/lib/theme";
import { Logo, LogoMark } from "./brand/Logo";
import { ThemeToggle } from "./ThemeToggle";
import { PhoneNav } from "./nav/PhoneNav";
import { AlertsBell } from "./AlertsBell";
import { SearchDialog } from "./SearchDialog";
import type { AlertItem } from "@/lib/alerts";

type Props = { name: string; roleName: string; permissions: string[]; theme: Theme; alerts: AlertItem[]; canSeeAlerts: boolean };

/** Desktop sidebar (icon rail on tablets) plus the phone navigation. */
export function Sidebar({ name, roleName, permissions, theme, alerts, canSeeAlerts }: Props) {
  const pathname = usePathname();
  const sections = navSections(permissions);

  return (
    <>
      <PhoneNav name={name} roleName={roleName} permissions={permissions} theme={theme} alerts={alerts} canSeeAlerts={canSeeAlerts} />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col border-r border-line bg-nav md:flex lg:w-64">
        <div className="flex flex-col items-center gap-1 py-3 lg:h-16 lg:flex-row lg:justify-between lg:py-0 lg:pr-3 lg:pl-5">
          <Link href="/" className="flex items-center">
            <LogoMark className="h-7 w-auto lg:hidden" />
            <span className="hidden lg:block"><Logo /></span>
          </Link>
          <div className="flex flex-col items-center gap-1 lg:flex-row">
            {permissions.includes("students.view") && <SearchDialog compact shortcuts />}
            {canSeeAlerts && <AlertsBell alerts={alerts} />}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-2">
          {sections.map((section, i) => (
            <div key={section.title ?? "top"} className={`space-y-0.5 ${i > 0 ? "mt-3 border-t border-line pt-3 lg:border-0 lg:pt-0" : ""}`}>
              {section.title && <p className="label-mono hidden px-3 pb-1 lg:block">{section.title}</p>}
              {section.items.map(({ href, label, icon: Icon }) => {
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
            </div>
          ))}
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
