import { progressLabel, type Progress, type Window } from "@/lib/curriculum";
import { LevelBadge } from "./ui";

/**
 * Progress through the group's section, one segment per level line (sized by its levels), like EduTrack's level bar:
 * "Frontend · JS · 3/5-daraja · 8/13 dars" and the section percentage. `sectionName` only for courses with several.
 */
export function CurriculumBar({ windows, progress, sectionName = null, mode = "card" }: { windows: Window[]; progress: Progress; sectionName?: string | null; mode?: "card" | "mini" }) {
  if (!windows.length) return null;
  // levels fully done: all of them when finished, none before the start, else those before the current one
  const doneBelow = progress.state === "finished" ? Infinity : progress.state === "not-started" || !progress.window ? -Infinity : progress.window.level;
  // subjects in order, with how many of their lessons are done
  const segments: { subject: string; months: number; lessons: number; done: number; current: boolean }[] = [];
  for (const w of windows) {
    let seg = segments.at(-1);
    if (!seg || seg.subject !== w.subject) segments.push((seg = { subject: w.subject, months: 0, lessons: 0, done: 0, current: false }));
    seg.months++;
    seg.lessons += w.lessons.length;
    if (progress.state !== "finished" && progress.window && w.level === progress.window.level) {
      seg.done += progress.doneInWindow;
      seg.current = true;
    } else if (w.level < doneBelow) seg.done += w.lessons.length;
  }
  const label = progress.state === "not-started" ? "Hali boshlanmagan" : progressLabel(sectionName, progress, windows[windows.length - 1].level);

  return (
    <div className={mode === "card" ? "space-y-2" : "space-y-1.5"}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`truncate ${mode === "card" ? "text-sm font-medium" : "text-xs text-muted"}`}>{label}</span>
        <span className="font-mono text-xs text-muted">{progress.percent}%</span>
      </div>
      <div className="flex gap-1" role="img" aria-label={`${label}, ${progress.percent}%`}>
        {segments.map((s, i) => (
          <div key={i} className="min-w-0" style={{ flex: s.months }}>
            <div className={`overflow-hidden rounded-full bg-ink/[.07] ${mode === "card" ? "h-2" : "h-1.5"} ${s.current ? "ring-1 ring-accent" : ""}`}>
              <div className={`h-full rounded-full ${s.done >= s.lessons ? "bg-ink" : "bg-accent"}`} style={{ width: `${s.lessons ? Math.round((s.done / s.lessons) * 100) : 0}%` }} />
            </div>
            {mode === "card" && <p className={`label-mono mt-1 truncate ${s.current ? "text-ink" : ""}`}>{s.subject}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Where the group is now: its current level, "Bo'lim tugadi", or (courses without levels) the old level label. */
export function CurriculumBadge({ progress, level }: { progress: Progress; level: string | null }) {
  if (progress.state === "none") return <LevelBadge level={level} />;
  if (progress.state === "finished") return <span className="badge bg-ink text-page">Bo&apos;lim tugadi</span>;
  const w = progress.window;
  return (
    <span className="badge border border-line-strong text-ink">
      <i className="h-1.5 w-1.5 rounded-full bg-accent" />
      {w ? w.label : "Boshlanmagan"}
    </span>
  );
}
