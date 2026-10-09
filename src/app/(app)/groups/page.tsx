import Link from "next/link";
import { Clock, DoorOpen, Plus, User } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can, groupScope } from "@/lib/access";
import { date, GROUP_DAYS, money } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { GroupFields } from "@/components/GroupFields";
import { Empty, PageHeader, SubmitRow } from "@/components/ui";
import { createGroup } from "../actions";

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requirePage("groups.view");
  const { status = "ACTIVE" } = await searchParams;
  const [groups, courses, teachers, rooms] = await Promise.all([
    db.group.findMany({
      where: { status, ...groupScope(user) },
      include: { course: true, teacher: true, assistant: true, room: true, _count: { select: { students: { where: { leftAt: null } } } } },
      orderBy: [{ days: "asc" }, { time: "asc" }],
    }),
    db.course.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({ where: { isTeacher: true, active: true }, orderBy: { name: "asc" } }),
    db.room.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title={can(user, "groups.all") ? "Guruhlar" : "Mening guruhlarim"} subtitle={`${groups.length} ta guruh`}>
        <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm">
          {[["ACTIVE", "Faol"], ["FINISHED", "Tugagan"]].map(([k, v]) => (
            <Link key={k} href={`/groups?status=${k}`} className={`rounded-md px-3 py-1.5 text-sm ${status === k ? "bg-brand-600 text-white" : "text-slate-600"}`}>{v}</Link>
          ))}
        </div>
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
        <p className="card mb-4 p-4 text-sm text-amber-700">Guruh ochish uchun avval <Link href="/courses" className="underline">kurs qo&apos;shing</Link>.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <Link key={g.id} href={`/groups/${g.id}`} className="card block p-5 transition hover:border-brand-500 hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">{g.name}</h3>
                <p className="text-sm text-brand-600">{g.course.name}</p>
              </div>
              <span className="badge bg-brand-50 text-brand-700">{g._count.students} o&apos;quvchi</span>
            </div>
            <div className="mt-4 space-y-1.5 text-sm text-slate-600">
              <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" />{GROUP_DAYS[g.days]} · {g.time}</p>
              <p className="flex items-center gap-2"><User className="h-4 w-4 text-slate-400" />{g.teacher?.name ?? "O'qituvchi biriktirilmagan"}{g.assistant && <span className="text-slate-400"> · yordamchi: {g.assistant.name}</span>}</p>
              <p className="flex items-center gap-2"><DoorOpen className="h-4 w-4 text-slate-400" />{g.room?.name ?? "Xona yo'q"}</p>
            </div>
            <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>Boshlangan: {date(g.startDate)}</span>
              <span>{money(g.course.price)}</span>
            </div>
          </Link>
        ))}
      </div>
      {groups.length === 0 && <div className="card"><Empty text="Guruhlar yo'q" /></div>}
    </>
  );
}
