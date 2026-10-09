import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { balance } from "@/lib/billing";
import { date, GROUP_DAYS, isoDate, lessonDates, money, MONTHS } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { GroupFields } from "@/components/GroupFields";
import { BalanceBadge, Empty, Field, SubmitRow } from "@/components/ui";
import { addStudentToGroup, deleteGroup, removeStudentFromGroup, toggleAttendance, updateGroup } from "../../actions";

export default async function GroupPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  const id = Number((await params).id);
  const { m } = await searchParams;
  const now = new Date();
  const [year, month] = m ? m.split("-").map(Number).map((v, i) => (i === 1 ? v - 1 : v)) : [now.getFullYear(), now.getMonth()];

  const group = await db.group.findUnique({
    where: { id },
    include: {
      course: true, teacher: true, room: true,
      students: {
        where: { leftAt: null },
        include: { student: { include: { payments: { select: { amount: true } }, groups: { include: { group: { include: { course: true } } } } } } },
        orderBy: { student: { name: "asc" } },
      },
    },
  });
  if (!group) notFound();

  const days = lessonDates(group.days, year, month);
  const [attendance, courses, teachers, rooms, others, session] = await Promise.all([
    db.attendance.findMany({ where: { groupId: id, date: { gte: days[0] ?? new Date(), lte: days.at(-1) ?? new Date() } } }),
    db.course.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({ where: { role: "TEACHER" }, orderBy: { name: "asc" } }),
    db.room.findMany({ orderBy: { name: "asc" } }),
    db.student.findMany({ where: { groups: { none: { groupId: id, leftAt: null } } }, orderBy: { name: "asc" } }),
    getSession(),
  ]);
  const mark = new Map(attendance.map((a) => [`${a.studentId}:${isoDate(a.date)}`, a.present]));
  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);
  const ym = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}`;
  const today = isoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));

  return (
    <>
      <Link href="/groups" className="text-sm text-slate-500 hover:text-brand-600">← Guruhlar</Link>
      <div className="card mt-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{group.name}</h1>
              {group.status === "FINISHED" && <span className="badge bg-slate-100 text-slate-600">Tugagan</span>}
            </div>
            <p className="text-brand-600">{group.course.name} · {money(group.course.price)} / oy</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Modal title="Guruhni tahrirlash" triggerClassName="btn-secondary" trigger={<><Pencil className="h-4 w-4" /> Tahrirlash</>}>
              <form action={updateGroup.bind(null, group.id)} className="space-y-3">
                <GroupFields courses={courses} teachers={teachers} rooms={rooms} g={group} />
                <SubmitRow />
              </form>
            </Modal>
            {session?.role === "ADMIN" && (
              <form action={deleteGroup.bind(null, group.id)}>
                <button className="btn-secondary text-rose-600"><Trash2 className="h-4 w-4" /> O&apos;chirish</button>
              </form>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
          <Info k="O'qituvchi" v={group.teacher?.name ?? "—"} />
          <Info k="Jadval" v={`${GROUP_DAYS[group.days]} · ${group.time}`} />
          <Info k="Xona" v={group.room?.name ?? "—"} />
          <Info k="Boshlangan" v={date(group.startDate)} />
        </div>
      </div>

      <div className="card mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h2 className="font-semibold">O&apos;quvchilar va davomat ({group.students.length})</h2>
          <div className="flex items-center gap-2">
            <Link href={`/groups/${id}?m=${ym(prev)}`} className="btn-secondary px-2"><ChevronLeft className="h-4 w-4" /></Link>
            <span className="w-32 text-center text-sm font-medium">{MONTHS[month]} {year}</span>
            <Link href={`/groups/${id}?m=${ym(next)}`} className="btn-secondary px-2"><ChevronRight className="h-4 w-4" /></Link>
            <Modal title="O'quvchi qo'shish" trigger={<><Plus className="h-4 w-4" /> Qo&apos;shish</>}>
              <form action={addStudentToGroup} className="space-y-3">
                <input type="hidden" name="groupId" value={id} />
                <Field label="O'quvchi">
                  <select name="studentId" className="input" required>
                    {others.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.phone}</option>)}
                  </select>
                </Field>
                <Field label="Qo'shilish sanasi"><input type="date" name="joinedAt" className="input" defaultValue={isoDate(new Date())} /></Field>
                <SubmitRow />
              </form>
            </Modal>
          </div>
        </div>
        <p className="px-5 pb-3 text-xs text-slate-500">Katakchani bosing: <span className="text-emerald-600">✓ keldi</span> → <span className="text-rose-600">✗ kelmadi</span> → bo&apos;sh</p>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-48 bg-slate-50">O&apos;quvchi</th>
                <th>Balans</th>
                {days.map((d) => (
                  <th key={d.toISOString()} className={`px-1 text-center ${isoDate(d) === today ? "text-brand-600" : ""}`}>{d.getUTCDate()}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {group.students.map(({ student }) => {
                const b = balance(student.groups, student.payments);
                return (
                  <tr key={student.id}>
                    <td className="sticky left-0 z-10 bg-white">
                      <Link href={`/students/${student.id}`} className="font-medium hover:text-brand-600">{student.name}</Link>
                      <p className="text-xs text-slate-500">{student.phone}</p>
                    </td>
                    <td><BalanceBadge value={b} label={money(b)} /></td>
                    {days.map((d) => {
                      const key = isoDate(d);
                      const v = mark.get(`${student.id}:${key}`);
                      return (
                        <td key={key} className="px-1 text-center">
                          <form action={toggleAttendance.bind(null, id, student.id, key)}>
                            <button
                              className={`h-7 w-7 rounded-md border text-sm font-bold ${
                                v === true ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                : v === false ? "border-rose-200 bg-rose-100 text-rose-700"
                                : "border-slate-200 bg-white text-slate-300 hover:border-brand-500"
                              }`}
                            >
                              {v === true ? "✓" : v === false ? "✗" : "·"}
                            </button>
                          </form>
                        </td>
                      );
                    })}
                    <td>
                      <form action={removeStudentFromGroup.bind(null, id, student.id)}>
                        <button className="text-xs text-rose-600 hover:underline">Chiqarish</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {group.students.length === 0 && <Empty text="Guruhda o'quvchi yo'q" />}
        </div>
      </div>
    </>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{k}</p>
      <p className="font-medium">{v}</p>
    </div>
  );
}
