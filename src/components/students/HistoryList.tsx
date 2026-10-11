import { date, money } from "@/lib/format";
import type { HistoryItem } from "@/lib/student-history";
import { Empty } from "@/components/ui";

const when = (d: Date) => `${date(d)} ${d.toLocaleTimeString("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" })}`;

/** "Tarix": everything that happened to the student, newest first. */
export function HistoryList({ items }: { items: HistoryItem[] }) {
  if (!items.length) return <Empty text="Tarix bo'sh" />;
  return (
    <ul className="divide-y divide-line">
      {items.map((i, k) => (
        <li key={k} className="grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] md:px-5">
          <div className="min-w-0">
            <p className="text-ink">{i.what}</p>
            {(i.group || i.amount !== null) && (
              <p className="text-xs text-muted">
                {i.group}
                {i.group && i.amount !== null ? " · " : ""}
                {i.amount !== null && <span className="font-medium text-success">+{money(i.amount)}</span>}
              </p>
            )}
          </div>
          <p className="label-mono sm:text-right">{i.who ?? "—"} · {when(i.at)}</p>
        </li>
      ))}
    </ul>
  );
}
