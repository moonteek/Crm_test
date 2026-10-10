"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SettingsTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${
            pathname === t.href ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
