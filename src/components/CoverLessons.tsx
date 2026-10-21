import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import type { CurrentUser } from "@/lib/access";
import { coveredToday } from "@/lib/cover-db";
import { centreDay } from "@/lib/membership-db";

/** "O'rinbosar darslaringiz": today's lessons the user covers in someone else's group, each opening its one-lesson page. */
export async function CoverLessons({ user }: { user: CurrentUser }) {
  const lessons = await coveredToday(user);
  if (!lessons.length) return null;
  const day = centreDay().toISOString().slice(0, 10);
  return (
    <section className="card mb-4 p-4 md:mb-6 md:p-5" aria-labelledby="cover-lessons">
      <h2 id="cover-lessons" className="mb-2 flex items-center gap-2 font-semibold"><ArrowLeftRight className="h-4 w-4 text-accent-ink" /> O&apos;rinbosar darslaringiz</h2>
      <div className="space-y-2">
        {lessons.map((l) => (
          <Link key={`${l.groupId}${l.makeup ? "m" : ""}`} href={`/lessons/${l.groupId}/${day}`} className="press flex items-center gap-4 rounded-xl border border-line bg-raised px-3.5 py-3 hover:border-line-strong">
            <span className="font-dot text-xl leading-none font-black">{l.time}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{l.name}</span>
              <span className="block truncate text-xs text-muted">{l.makeup ? "Qo'shimcha dars" : "O'rinbosar"}{l.room ? ` · ${l.room}` : ""}</span>
            </span>
            <span className="label-mono">Davomat →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
