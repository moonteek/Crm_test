import Link from "next/link";
import { Clock, DoorOpen, RotateCcw, User } from "lucide-react";
import { db } from "@/lib/db";
import { priceNow } from "@/lib/billing";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/access";
import { date, GROUP_DAYS, money } from "@/lib/format";
import { loadGroups, PROGRESS, type GroupFilters } from "@/lib/lists/groups";
import { ExportButtons } from "@/components/ExportButtons";
import { CurriculumBadge, CurriculumBar } from "@/components/CurriculumBar";
import { CoverLessons } from "@/components/CoverLessons";
import { Empty, PageHeader, Segmented } from "@/components/ui";
import { restoreGroup } from "../actions";
import { NewGroupDialog } from "@/components/NewGroupDialog";
import { ActionButton } from "@/components/ActionForm";

export default async function GroupsPage({ searchParams }: { searchParams: Promise<GroupFilters> }) {
  const user = await requirePage("groups.view");
  const params = await searchParams;
  const [{ status, courseId, subjectId, progress, unmarked, courses, subjectOptions, groups }, teachers, rooms] = await Promise.all([
    loadGroups(user, params),
    db.user.findMany({ where: { isTeacher: true, active: true }, orderBy: { name: "asc" } }),
    db.room.findMany({ orderBy: { name: "asc" } }),
  ]);
  const filtered = Boolean(courseId || subjectId || progress || unmarked);
  const archive = status === "FINISHED";
  const href = (s: string) => `/groups?status=${s}`;

  return (
    <>
      <PageHeader title={can(user, "groups.all") ? "Guruhlar" : "Mening guruhlarim"} subtitle={`${groups.length} ta guruh`}>
        <ExportButtons href="/groups/export" />
        <Segmented options={[{ href: href("ACTIVE"), label: "Faol", active: !archive }, { href: href("FINISHED"), label: "Arxiv", active: archive }]} />
        {can(user, "groups.manage") && courses.length > 0 && (
          <NewGroupDialog courses={courses} teachers={teachers} rooms={rooms} />
        )}
      </PageHeader>
      <CoverLessons user={user} />

      {can(user, "groups.manage") && courses.length === 0 && (
        <p className="card mb-4 p-4 text-sm text-warning">Guruh ochish uchun avval <Link href="/courses" className="underline">kurs qo&apos;shing</Link>.</p>
      )}

      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end" aria-label="Filtrlar">
        <input type="hidden" name="status" value={status} />
        <select name="course" defaultValue={courseId ?? ""} className="input col-span-2 min-w-0 sm:w-auto" aria-label="Kurs">
          <option value="">Barcha kurslar</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="subject" defaultValue={subjectId ?? ""} className="input min-w-0 sm:w-auto" aria-label="Hozirgi daraja">
          <option value="">Barcha darajalar</option>
          {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select name="progress" defaultValue={progress ?? ""} className="input min-w-0 sm:w-auto" aria-label="Holat">
          <option value="">Har qanday holat</option>
          {Object.entries(PROGRESS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        {status === "ACTIVE" && (
          <label className="col-span-2 flex items-center gap-2 text-sm text-muted sm:col-span-1">
            <input type="checkbox" name="unmarked" value="1" defaultChecked={unmarked} className="h-4 w-4 accent-accent" /> Davomat qilinmagan
          </label>
        )}
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
              {g.cur.windows.length > 0 && <div className="mt-4"><CurriculumBar windows={g.cur.windows} progress={g.cur.progress} sectionName={g.course._count.sections > 1 ? g.section?.name ?? null : null} mode="mini" /></div>}
              <div className="label-mono mt-4 flex justify-between border-t border-line pt-3">
                <span>Boshlangan: {date(g.startDate)}</span>
                <span>{money(priceNow(g))}</span>
              </div>
            </Link>
            {archive && can(user, "groups.manage") && (
              <div className="border-t border-line px-5 py-3">
                <ActionButton action={restoreGroup.bind(null, g.id)} className="btn-ghost -ml-2 px-2 text-sm" alignLeft><RotateCcw className="h-4 w-4" /> Qayta tiklash</ActionButton>
              </div>
            )}
          </div>
        ))}
      </div>
      {groups.length === 0 && <div className="card"><Empty text={filtered ? "Filtrga mos guruh yo'q" : archive ? "Arxiv bo'sh" : "Guruhlar yo'q"} /></div>}
    </>
  );
}
