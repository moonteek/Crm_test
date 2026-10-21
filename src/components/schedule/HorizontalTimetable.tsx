import Link from "next/link";
import { AlertTriangle, BookOpen, DoorOpen, User, Users } from "lucide-react";
import { fromMinutes } from "@/lib/schedule";
import { COURSE_TONE, lanes, placeOn, timelineRange, type CourseColor } from "@/lib/timetable";
import type { Progress } from "@/lib/curriculum";
import { CurriculumBadge } from "@/components/CurriculumBar";

export type TimetableLesson = {
  id: number; name: string; level: string | null; start: number; end: number; progress: Progress; exam: boolean;
  roomId: number | null; color: CourseColor; cancelled: boolean; passed: number; makeup?: boolean;
  course: { name: string }; teacher: { name: string } | null; assistant: { name: string } | null;
  room: { name: string; capacity: number } | null; _count: { students: number };
};

const LANE = 132; // px per lesson row inside a room
const SLOT = 64; // px per half hour

/** Rooms down, the day's hours across; each lesson a card at its time, overlapping ones stacked. */
export function HorizontalTimetable({
  rooms, lessons, clashes, now,
}: {
  rooms: { id: number; name: string; capacity: number }[];
  lessons: TimetableLesson[];
  clashes: Map<number, { room: boolean; teacher: boolean }>;
  now: number | null; // minutes since midnight when the shown day is today
}) {
  const range = timelineRange(lessons);
  const slots = (range.to - range.from) / 30;
  const nowAt = now !== null && now >= range.from && now <= range.to ? placeOn(range, range.from, now).width : null;

  return (
    <div className="card overflow-x-auto">
      <div style={{ minWidth: `${8 + (slots * SLOT) / 16}rem` }}>
        {/* hours */}
        <div className="sticky top-0 z-10 flex border-b border-line bg-surface">
          <div className="label-mono sticky left-0 z-10 w-32 shrink-0 border-r border-line bg-surface px-3 py-3">Xona / vaqt</div>
          <div className="relative flex-1">
            {Array.from({ length: slots }, (_, i) => (
              <span
                key={i}
                className={`absolute top-0 bottom-0 border-l border-line pt-3 pl-1.5 font-mono text-[11px] ${i % 2 ? "text-faint" : "text-ink"}`}
                style={{ left: `${(i / slots) * 100}%` }}
              >
                {fromMinutes(range.from + i * 30)}
              </span>
            ))}
          </div>
        </div>
        {/* rooms */}
        {rooms.map((r) => {
          const own = lessons.filter((l) => (l.roomId ?? 0) === r.id);
          const { lane, count } = lanes(own);
          return (
            <div key={r.id} className="flex border-b border-line last:border-0">
              <div className="sticky left-0 z-10 flex w-32 shrink-0 flex-col justify-center border-r border-line bg-surface px-3 py-2">
                <span className="flex items-center gap-1.5 font-medium text-ink"><DoorOpen className="h-4 w-4 shrink-0 text-faint" /><span className="truncate">{r.name}</span></span>
                {r.capacity > 0 && <span className="label-mono mt-0.5">{r.capacity} o&apos;rin</span>}
              </div>
              <div className="relative flex-1" style={{ height: own.length ? count * LANE + 8 : 56 /* a free room stays short */ }}>
                {Array.from({ length: slots }, (_, i) => (
                  <span key={i} className={`absolute top-0 bottom-0 border-l ${i % 2 ? "border-line/50" : "border-line"}`} style={{ left: `${(i / slots) * 100}%` }} />
                ))}
                {nowAt !== null && <span className="absolute top-0 bottom-0 z-[1] w-0.5 bg-accent" style={{ left: `${nowAt}%` }} title="Hozir" />}
                {own.map((l) => {
                  const at = placeOn(range, l.start, l.end);
                  return (
                    <div key={l.id} className="absolute p-1" style={{ left: `${at.left}%`, width: `${at.width}%`, top: 4 + lane.get(l.id)! * LANE, height: LANE }}>
                      <TimetableCard lesson={l} clash={clashes.get(l.id)} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimetableCard({ lesson: l, clash }: { lesson: TimetableLesson; clash?: { room: boolean; teacher: boolean } }) {
  const tone = COURSE_TONE[l.color];
  const full = l.room !== null && l._count.students > l.room.capacity;
  return (
    <Link
      href={`/groups/${l.id}`}
      title={l.cancelled ? "Dars bekor qilingan" : l.makeup ? "Qo'shimcha dars" : undefined}
      className={`press flex h-full flex-col overflow-hidden rounded-xl border border-l-4 px-2.5 py-2 text-xs ${l.makeup ? "border-dashed " : ""}${
        l.cancelled ? "border-line bg-raised text-faint" : clash ? "border-warning bg-warning-tint" : `${tone.card} hover:brightness-95`
      }`}
    >
      <span className="flex items-center justify-between gap-1.5">
        <span className={`truncate text-sm font-semibold ${l.cancelled ? "line-through" : "text-ink"}`}>{l.name}</span>
        {l.exam && !l.cancelled && <span className="badge shrink-0 bg-accent text-on-accent">Imtihon</span>}
      </span>
      <span className={`truncate font-medium ${l.cancelled ? "" : tone.ink}`}>{l.makeup ? "Qo'shimcha dars" : l.course.name}</span>
      <span className="mt-0.5 flex items-center gap-1 truncate text-muted">
        <User className="h-3 w-3 shrink-0" />
        <span className="truncate">{l.teacher?.name ?? "O'qituvchi yo'q"}{l.assistant && ` + ${l.assistant.name}`}</span>
      </span>
      {l.cancelled ? (
        <span className="mt-auto font-medium">Bekor qilingan · {fromMinutes(l.start)}–{fromMinutes(l.end)}</span>
      ) : (
        <span className="mt-auto flex flex-wrap items-center gap-1">
          <span className="rounded-md bg-surface/70 px-1.5 py-0.5 font-mono text-ink">{fromMinutes(l.start)}–{fromMinutes(l.end)}</span>
          <span className={`flex items-center gap-0.5 rounded-md bg-surface/70 px-1.5 py-0.5 ${full ? "font-semibold text-danger" : "text-ink"}`} title={full ? "Xonaga sig'maydi" : "O'quvchilar / o'rinlar"}>
            <Users className="h-3 w-3" />{l._count.students}{l.room ? `/${l.room.capacity}` : ""}
          </span>
          <span className="flex items-center gap-0.5 rounded-md bg-surface/70 px-1.5 py-0.5 text-ink" title="O'tilgan darslar (shu kun bilan)">
            <BookOpen className="h-3 w-3" />{l.passed}
          </span>
          <CurriculumBadge progress={l.progress} level={l.level} />
        </span>
      )}
      {clash && !l.cancelled && (
        <span className="mt-0.5 flex items-center gap-1 font-medium text-warning">
          <AlertTriangle className="h-3 w-3 shrink-0" />{[clash.room && "Xona band", clash.teacher && "O'qituvchi band"].filter(Boolean).join(", ")}
        </span>
      )}
    </Link>
  );
}
