import Link from "next/link";
import { Clock, DoorOpen, Plus, User } from "lucide-react";
import { db } from "@/lib/db";
import { priceNow } from "@/lib/billing";
import { requirePage } from "@/lib/auth";
import { can, groupScope } from "@/lib/access";
import { date, GROUP_DAYS, money } from "@/lib/format";
import { curriculumOn } from "@/lib/curriculum";
import { centreDay } from "@/lib/membership-db";
import { Modal } from "@/components/Modal";
import { GroupFields } from "@/components/GroupFields";
import { CurriculumBadge, CurriculumBar } from "@/components/CurriculumBar";
import { Empty, PageHeader, Segmented, SubmitRow } from "@/components/ui";
import { createGroup } from "../actions";

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requirePage("groups.view");
  const { status = "ACTIVE" } = await searchParams;
  const [groups, courses, teachers, rooms] = await Promise.all([
    db.group.findMany({
      where: { status, ...groupScope(user) },
      include: { course: { include: { subjects: true } }, teacher: true, assistant: true, room: true, prices: true, _count: { select: { students: { where: { leftAt: null } } } } },
      orderBy: [{ days: "asc" }, { time: "asc" }],
    }),
    db.course.findMany({ orderBy: { name: "asc" }, include: { subjects: { orderBy: { position: "asc" } } } }),
    db.user.findMany({ where: { isTeacher: true, active: true }, orderBy: { name: "asc" } }),
    db.room.findMany({ orderBy: { name: "asc" } }),
  ]);
  const today = centreDay();

  return (
    <>
      <PageHeader title={can(user, "groups.all") ? "Guruhlar" : "Mening guruhlarim"} subtitle={`${groups.length} ta guruh`}>
        <Segmented options={[["ACTIVE", "Faol"], ["FINISHED", "Tugagan"]].map(([k, v]) => ({ href: `/groups?status=${k}`, label: v, active: status === k }))} />
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-3">
        {groups.map((g) => { const cur = curriculumOn(g, g.course.subjects, today); return (
          <Link key={g.id} href={`/groups/${g.id}`} className="card press block p-5 hover:border-line-strong">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-semibold">{g.name}</h3>
                  <CurriculumBadge progress={cur.progress} level={g.level} />
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
            {cur.windows.length > 0 && <div className="mt-4"><CurriculumBar windows={cur.windows} progress={cur.progress} mode="mini" /></div>}
            <div className="label-mono mt-4 flex justify-between border-t border-line pt-3">
              <span>Boshlangan: {date(g.startDate)}</span>
              <span>{money(priceNow(g))}</span>
            </div>
          </Link>
        ); })}
      </div>
      {groups.length === 0 && <div className="card"><Empty text="Guruhlar yo'q" /></div>}
    </>
  );
}
