import Link from "next/link";
import { AlertTriangle, DoorOpen, User, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can, groupScope } from "@/lib/access";
import { centreWeekday, findClashes, fromMinutes, scheduleKeysOn, toMinutes, WEEKDAYS } from "@/lib/schedule";
import { Empty, LevelBadge, PageHeader } from "@/components/ui";

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
      <PageHeader title="Dars jadvali" subtitle={`${dayLabel} · ${lessons.length} ta dars · ${totalStudents} o'quvchi`} />

      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-lg bg-white p-1 shadow-sm" aria-label="Hafta kunlari">
        {WEEKDAYS.map((w) => (
          <Link
            key={w.day}
            href={`/schedule?d=${w.day}`}
            aria-current={w.day === day ? "page" : undefined}
            className={`flex shrink-0 flex-1 flex-col items-center rounded-md px-3 py-2 text-sm ${w.day === day ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <span className="font-medium"><span className="sm:hidden">{w.short}</span><span className="hidden sm:inline">{w.label}</span></span>
            <span className={`text-xs ${w.day === day ? "text-brand-100" : "text-slate-400"}`}>
              {w.day === today ? "Bugun · " : ""}{perDay.get(w.day)?.length ?? 0} ta
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
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="w-24 px-3 py-2 font-medium text-slate-500">Vaqt</th>
                  {rooms.map((r) => (
                    <th key={r.id} className="px-3 py-2 font-medium text-slate-700">
                      <span className="flex items-center gap-1.5"><DoorOpen className="h-4 w-4 text-slate-400" />{r.name}</span>
                      {r.capacity > 0 && <span className="block text-xs font-normal text-slate-400">{r.capacity} o&apos;rin</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {startTimes.map((t) => (
                  <tr key={t} className="border-b border-slate-100 align-top last:border-0">
                    <th scope="row" className="px-3 py-3 text-left font-semibold text-slate-700">{fromMinutes(t)}</th>
                    {rooms.map((r) => (
                      <td key={r.id} className="px-2 py-2">
                        <div className="space-y-2">
                          {ongoing.get(cell(t, r.id))?.map((l) => (
                            <Link
                              key={`cont-${l.id}`}
                              href={`/groups/${l.id}`}
                              className="block truncate rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 hover:border-brand-500"
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
      className={`block rounded-lg border p-3 transition hover:shadow-md ${clash ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white hover:border-brand-500"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-900">{fromMinutes(l.start)}–{fromMinutes(l.end)}</span>
        <LevelBadge level={l.level} />
      </div>
      <p className="mt-1 truncate font-medium text-slate-800">{l.name}</p>
      <p className="truncate text-xs text-brand-600">{l.course.name}</p>
      <div className="mt-2 space-y-1 text-xs text-slate-600">
        <p className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">{l.teacher?.name ?? "O'qituvchi yo'q"}{l.assistant && <span className="text-slate-400"> + {l.assistant.name}</span>}</span>
        </p>
        {showRoom && <p className="flex items-center gap-1.5"><DoorOpen className="h-3.5 w-3.5 shrink-0 text-slate-400" />{l.room?.name ?? "Xona belgilanmagan"}</p>}
        <p className={`flex items-center gap-1.5 ${full ? "font-medium text-rose-600" : ""}`}>
          <Users className={`h-3.5 w-3.5 shrink-0 ${full ? "text-rose-500" : "text-slate-400"}`} />
          {l._count.students}{l.room ? ` / ${l.room.capacity}` : ""} o&apos;quvchi{full && " — sig'maydi"}
        </p>
      </div>
      {clash && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {[clash.room && "Xona band", clash.teacher && "O'qituvchi band"].filter(Boolean).join(", ")}
        </p>
      )}
    </Link>
  );
}
