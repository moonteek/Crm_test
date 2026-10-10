"use client";

import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Yorug'", icon: Sun },
  { value: "dark", label: "Tungi", icon: Moon },
  { value: "auto", label: "Avto", icon: Monitor },
];

/** Light / dark / auto switch; remembered in a cookie so the server renders the same theme next time. */
export function ThemeToggle({ initial, compact = false }: { initial: Theme; compact?: boolean }) {
  const [theme, setTheme] = useState(initial);

  function choose(next: Theme) {
    setTheme(next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    const root = document.documentElement;
    root.classList.add("theme-fade");
    if (next === "auto") delete root.dataset.theme;
    else root.dataset.theme = next;
    setTimeout(() => root.classList.remove("theme-fade"), 300);
  }

  return (
    <div role="radiogroup" aria-label="Mavzu" className={`flex rounded-full border border-line bg-raised p-0.5 ${compact ? "flex-col" : ""}`}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => choose(value)}
          className={`press flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium ${
            theme === value ? "bg-ink text-page" : "text-muted hover:text-ink"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {!compact && label}
        </button>
      ))}
    </div>
  );
}
