import Link from "next/link";
import { AlertTriangle, DoorOpen, User, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can, groupScope } from "@/lib/access";
import { centreWeekday, findClashes, fromMinutes, scheduleKeysOn, toMinutes, WEEKDAYS } from "@/lib/schedule";
import { DotMeter, Empty, LevelBadge, PageHeader } from "@/components/ui";

const NO_ROOM = 0;

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const user = await requirePage("groups.view");
  const today = centreWeekday();
  const picked = Number((await searchParams).d);
  // Sunday has no lessons, so it opens on Monday
  const day = WEEKDAYS.some((w) => w.day === picked) ? picked : today === 0 ? 1 : today;
  const seesAll = can(user, "groups.all");

  const [groups, centreGroups, allRooms] = await Promise.all([
    db.group.findMany({
      where: { status: "ACTIVE", ...groupScope(user) },
      include: { course: true, teacher: true, assistant: true, room: true, _count: { select: { students: { where: { leftAt: null } } } } },
      orderBy: { time: "asc" },
    }),
    // clashes are checked against every group, including ones this user can't see
    seesAll
      ? null
      : db.group.findMany({
          where: { status: "ACTIVE", days: { in: scheduleKeysOn(day) } },
          select: { id: true, time: true, roomId: true, teacherId: true, assistantId: true, course: { select: { lessonMin: true } } },
        }),
    db.room.findMany({ orderBy: { name: "asc" } }),
  ]);

  const perDay = new Map(WEEKDAYS.map((w) => [w.day, groups.filter((g) => scheduleKeysOn(w.day).includes(g.days))]));
  const withTimes = <G extends { time: string; course: { lessonMin: number } }>(g: G) => {
    const start = toMinutes(g.time);
    return { ...g, start, end: start + g.course.lessonMin };
  };
  const lessons = (perDay.get(day) ?? []).map(withTimes);
  const clashes = findClashes(
    (centreGroups?.map(withTimes) ?? lessons).map((l) => ({
      id: l.id, start: l.start, end: l.end, roomId: l.roomId,
      teacherIds: [l.teacherId, l.assistantId].filter((t): t is number => t !== null),
    })),
  );

  // whole-centre view shows every room; a teacher only sees the rooms they teach in
  const usedRoomIds = new Set(lessons.map((l) => l.roomId ?? NO_ROOM));
  const rooms = [
    ...(seesAll ? allRooms : allRooms.filter((r) => usedRoomIds.has(r.id))),
    ...(usedRoomIds.has(NO_ROOM) ? [{ id: NO_ROOM, name: "Xona belgilanmagan", capacity: 0 }] : []),
  ];
  const startTimes = [...new Set(lessons.map((l) => l.start))].sort((a, b) => a - b);
  // grid cells keyed by "start:room": lessons starting there, and lessons still running from an earlier row
  const cell = (t: number, roomId: number) => `${t}:${roomId}`;
  const starting = new Map<string, typeof lessons>();
  const ongoing = new Map<string, typeof lessons>();
  const push = (m: Map<string, typeof lessons>, k: string, l: (typeof lessons)[number]) => m.set(k, [...(m.get(k) ?? []), l]);
  for (const l of lessons) {
    const room = l.roomId ?? NO_ROOM;
    push(starting, cell(l.start, room), l);
    for (const t of startTimes) if (t > l.start && t < l.end) push(ongoing, cell(t, room), l);
  }
  const totalStudents = lessons.reduce((s, l) => s + l._count.students, 0);
  const dayLabel = WEEKDAYS.find((w) => w.day === day)!.label;

  return (
    <>
      <PageHeader eyebrow="Haftalik jadval" title="Dars jadvali" subtitle={`${dayLabel} · ${lessons.length} ta dars · ${totalStudents} o'quvchi`} />

      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1" aria-label="Hafta kunlari">
        {WEEKDAYS.map((w) => (
          <Link
            key={w.day}
            href={`/schedule?d=${w.day}`}
            aria-current={w.day === day ? "page" : undefined}
            className={`press flex shrink-0 flex-1 flex-col items-center rounded-full px-3 py-1.5 text-sm ${w.day === day ? "bg-nav-active text-nav-active-ink" : "text-muted hover:bg-ink/5 hover:text-ink"}`}
          >
            <span className="font-medium"><span className="sm:hidden">{w.short}</span><span className="hidden sm:inline">{w.label}</span></span>
            <span className={`font-mono text-[10.5px] whitespace-nowrap ${w.day === day ? "opacity-70" : "text-faint"}`}>
              {w.day === today && <><span className="hidden sm:inline">Bugun · </span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle sm:hidden" /></>}{perDay.get(w.day)?.length ?? 0} ta
            </span>
          </Link>
        ))}
      </nav>

      {lessons.length === 0 ? (
        <div className="card"><Empty text="Bu kunda darslar yo'q" /></div>
      ) : (
        <>
          {/* phones: one list ordered by time */}
          <div className="space-y-3 md:hidden">
            {lessons.map((l) => <LessonCard key={l.id} lesson={l} clash={clashes.get(l.id)} showRoom />)}
          </div>

          {/* wider screens: rooms across, start times down */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: `${6 + rooms.length * 14}rem` }}>
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="label-mono w-24 px-3 py-3">Vaqt</th>
                  {rooms.map((r) => (
                    <th key={r.id} className="px-3 py-3 font-medium text-ink">
                      <span className="flex items-center gap-1.5"><DoorOpen className="h-4 w-4 text-faint" />{r.name}</span>
                      {r.capacity > 0 && <span className="label-mono mt-0.5 block font-normal">{r.capacity} o&apos;rin</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {startTimes.map((t) => (
                  <tr key={t} className="border-b border-line align-top last:border-0">
                    <th scope="row" className="px-3 py-3 text-left font-dot text-xl font-black text-ink">{fromMinutes(t)}</th>
                    {rooms.map((r) => (
                      <td key={r.id} className="px-2 py-2">
                        <div className="space-y-2">
                          {ongoing.get(cell(t, r.id))?.map((l) => (
                            <Link
                              key={`cont-${l.id}`}
                              href={`/groups/${l.id}`}
                              className="block truncate rounded-xl border border-dashed border-line-strong px-3 py-1.5 text-xs text-muted hover:border-ink hover:text-ink"
                            >
                              ↳ {l.name} · {fromMinutes(l.end)} gacha
                            </Link>
                          ))}
                          {starting.get(cell(t, r.id))?.map((l) => <LessonCard key={l.id} lesson={l} clash={clashes.get(l.id)} />)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

type Lesson = {
  id: number; name: string; level: string | null; start: number; end: number;
  course: { name: string }; teacher: { name: string } | null; assistant: { name: string } | null;
  room: { name: string; capacity: number } | null; _count: { students: number };
};

function LessonCard({ lesson: l, clash, showRoom = false }: { lesson: Lesson; clash?: { room: boolean; teacher: boolean }; showRoom?: boolean }) {
  const full = l.room !== null && l._count.students > l.room.capacity;
  return (
    <Link
      href={`/groups/${l.id}`}
      className={`press block rounded-xl border p-3 ${clash ? "border-warning bg-warning-tint" : "border-line bg-raised hover:border-line-strong"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-dot text-lg leading-none font-black text-ink">{fromMinutes(l.start)}<span className="label-mono ml-1.5 align-middle">→ {fromMinutes(l.end)}</span></span>
        <LevelBadge level={l.level} />
      </div>
      <p className="mt-1 truncate font-medium text-ink">{l.name}</p>
      <p className="truncate text-xs text-muted">{l.course.name}</p>
      <div className="mt-2 space-y-1 text-xs text-muted">
        <p className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 shrink-0 text-faint" />
          <span className="truncate">{l.teacher?.name ?? "O'qituvchi yo'q"}{l.assistant && <span className="text-faint"> + {l.assistant.name}</span>}</span>
        </p>
        {showRoom && <p className="flex items-center gap-1.5"><DoorOpen className="h-3.5 w-3.5 shrink-0 text-faint" />{l.room?.name ?? "Xona belgilanmagan"}</p>}
        <p className={`flex items-center gap-1.5 ${full ? "font-medium text-danger" : ""}`}>
          <Users className={`h-3.5 w-3.5 shrink-0 ${full ? "text-danger" : "text-faint"}`} />
          {l._count.students}{l.room ? ` / ${l.room.capacity}` : ""} o&apos;quvchi{full && " — sig'maydi"}
          {l.room && !full && <span className="ml-auto"><DotMeter value={l._count.students} max={l.room.capacity} /></span>}
        </p>
      </div>
      {clash && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {[clash.room && "Xona band", clash.teacher && "O'qituvchi band"].filter(Boolean).join(", ")}
        </p>
      )}
    </Link>
  );
}
