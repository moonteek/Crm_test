"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SettingsTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${
            pathname === t.href ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
