import Link from "next/link";
import { Clock, DoorOpen, Plus, RotateCcw, User } from "lucide-react";
import { db } from "@/lib/db";
import { priceNow } from "@/lib/billing";
import { requirePage } from "@/lib/auth";
import { can, groupScope } from "@/lib/access";
import { date, GROUP_DAYS, money } from "@/lib/format";
import { curriculumOn, type Progress } from "@/lib/curriculum";
import { centreDay } from "@/lib/membership-db";
import { Modal } from "@/components/Modal";
import { GroupFields } from "@/components/GroupFields";
import { CurriculumBadge, CurriculumBar } from "@/components/CurriculumBar";
import { Empty, PageHeader, Segmented, SubmitRow } from "@/components/ui";
import { createGroup, restoreGroup } from "../actions";

const PROGRESS: Record<Progress["state"], string> = {
  "not-started": "Boshlanmagan",
  "in-progress": "O'qimoqda",
  finishing: "Oxirgi oy",
  finished: "Kursi tugagan",
  none: "Fanlarsiz",
};

type Filters = { status?: string; course?: string; subject?: string; progress?: string };

export default async function GroupsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const user = await requirePage("groups.view");
  const params = await searchParams;
  const status = params.status === "FINISHED" ? "FINISHED" : "ACTIVE";
  const courseId = Number(params.course) || null;
  const asked = Number(params.subject) || null;
  const progress = params.progress && params.progress in PROGRESS ? (params.progress as Progress["state"]) : null;
  const [all, courses, teachers, rooms] = await Promise.all([
    db.group.findMany({
      where: { status, ...(courseId ? { courseId } : {}), ...groupScope(user) },
      include: { course: { include: { subjects: true } }, teacher: true, assistant: true, room: true, prices: true, _count: { select: { students: { where: { leftAt: null } } } } },
      orderBy: [{ days: "asc" }, { time: "asc" }],
    }),
    db.course.findMany({ orderBy: { name: "asc" }, include: { subjects: { orderBy: { position: "asc" } } } }),
    db.user.findMany({ where: { isTeacher: true, active: true }, orderBy: { name: "asc" } }),
    db.room.findMany({ orderBy: { name: "asc" } }),
  ]);
  const subjectOptions = courses.filter((c) => !courseId || c.id === courseId).flatMap((c) => c.subjects.map((s) => ({ id: s.id, label: courseId ? s.name : `${c.name} · ${s.name}` })));
  // a subject of another course (left in the link after switching course) is ignored
  const subjectId = subjectOptions.some((s) => s.id === asked) ? asked : null;
  const today = centreDay();
  const groups = all
    .map((g) => ({ ...g, cur: curriculumOn(g, g.course.subjects, today) }))
    .filter((g) => (!subjectId || (g.cur.progress.state !== "finished" && g.cur.progress.window?.subjectId === subjectId)) && (!progress || g.cur.progress.state === progress));
  const filtered = Boolean(courseId || subjectId || progress);
  const archive = status === "FINISHED";
  const href = (s: string) => `/groups?status=${s}`;

  return (
    <>
      <PageHeader title={can(user, "groups.all") ? "Guruhlar" : "Mening guruhlarim"} subtitle={`${groups.length} ta guruh`}>
        <Segmented options={[{ href: href("ACTIVE"), label: "Faol", active: !archive }, { href: href("FINISHED"), label: "Arxiv", active: archive }]} />
        {can(user, "groups.manage") && courses.length > 0 && (
          <Modal title="Yangi guruh" trigger={<><Plus className="h-4 w-4" /> Guruh ochish</>}>
            <form action={createGroup} className="space-y-3">
              <GroupFields courses={courses} teachers={teachers} rooms={rooms} />
              <SubmitRow />
            </form>
          </Modal>
        )}
      </PageHeader>

      {can(user, "groups.manage") && courses.length === 0 && (
        <p className="card mb-4 p-4 text-sm text-warning">Guruh ochish uchun avval <Link href="/courses" className="underline">kurs qo&apos;shing</Link>.</p>
      )}

      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end" aria-label="Filtrlar">
        <input type="hidden" name="status" value={status} />
        <select name="course" defaultValue={courseId ?? ""} className="input col-span-2 min-w-0 sm:w-auto" aria-label="Kurs">
          <option value="">Barcha kurslar</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="subject" defaultValue={subjectId ?? ""} className="input min-w-0 sm:w-auto" aria-label="Hozirgi fan">
          <option value="">Barcha fanlar</option>
          {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select name="progress" defaultValue={progress ?? ""} className="input min-w-0 sm:w-auto" aria-label="Holat">
          <option value="">Har qanday holat</option>
          {Object.entries(PROGRESS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <button className="btn-secondary">Filtrlash</button>
        {filtered && <Link href={href(status)} className="btn-ghost">Tozalash</Link>}
      </form>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-3">
        {groups.map((g) => (
          <div key={g.id} className={`card overflow-hidden hover:border-line-strong ${archive ? "opacity-90" : ""}`}>
            <Link href={`/groups/${g.id}`} className="press block p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-lg font-semibold">{g.name}</h3>
                    <CurriculumBadge progress={g.cur.progress} level={g.level} />
                  </div>
                  <p className="truncate text-sm text-muted">{g.course.name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-dot text-2xl leading-none font-black">{g._count.students}</p>
                  <p className="label-mono mt-1">o&apos;quvchi</p>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-muted">
                <p className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0 text-faint" />{GROUP_DAYS[g.days]} · <span className="font-mono">{g.time}</span></p>
                <p className="flex min-w-0 items-center gap-2"><User className="h-4 w-4 shrink-0 text-faint" /><span className="truncate">{g.teacher?.name ?? "O'qituvchi biriktirilmagan"}{g.assistant && <span className="text-faint"> · yordamchi: {g.assistant.name}</span>}</span></p>
                <p className="flex items-center gap-2"><DoorOpen className="h-4 w-4 text-faint" />{g.room?.name ?? "Xona yo'q"}</p>
              </div>
              {g.cur.windows.length > 0 && <div className="mt-4"><CurriculumBar windows={g.cur.windows} progress={g.cur.progress} mode="mini" /></div>}
              <div className="label-mono mt-4 flex justify-between border-t border-line pt-3">
                <span>Boshlangan: {date(g.startDate)}</span>
                <span>{money(priceNow(g))}</span>
              </div>
            </Link>
            {archive && can(user, "groups.manage") && (
              <form action={restoreGroup.bind(null, g.id)} className="border-t border-line px-5 py-3">
                <button className="btn-ghost -ml-2 px-2 text-sm"><RotateCcw className="h-4 w-4" /> Qayta tiklash</button>
              </form>
            )}
          </div>
        ))}
      </div>
      {groups.length === 0 && <div className="card"><Empty text={filtered ? "Filtrga mos guruh yo'q" : archive ? "Arxiv bo'sh" : "Guruhlar yo'q"} /></div>}
    </>
  );
}
