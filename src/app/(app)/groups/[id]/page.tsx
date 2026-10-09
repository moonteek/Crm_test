import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can, canSeeBalances, groupScope } from "@/lib/access";
import { balance } from "@/lib/billing";
import { date, GROUP_DAYS, isoDate, lessonDates, money, MONTHS } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { GroupFields } from "@/components/GroupFields";
import { BalanceBadge, Empty, Field, SubmitRow } from "@/components/ui";
import { GradeCell } from "@/components/GradeCell";
import { addStudentToGroup, createExam, deleteExam, deleteGroup, removeStudentFromGroup, toggleAttendance, updateGroup } from "../../actions";

export default async function GroupPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string; tab?: string }> }) {
  const user = await requirePage("groups.view");
  const allow = {
    edit: can(user, "groups.manage"),
    remove: can(user, "groups.delete"),
    students: can(user, "students.manage"),
    attendance: can(user, "attendance.mark"),
    grades: can(user, "grades.manage"),
    balance: canSeeBalances(user),
  };
  const id = Number((await params).id);
  const { m, tab: tabParam } = await searchParams;
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam! : "attendance";
  const now = new Date();
  const [year, month] = m ? m.split("-").map(Number).map((v, i) => (i === 1 ? v - 1 : v)) : [now.getFullYear(), now.getMonth()];

  const group = await db.group.findFirst({
    where: { id, ...groupScope(user) },
    include: {
      course: true, teacher: true, assistant: true, room: true,
      students: {
        where: { leftAt: null },
        include: { student: { include: { payments: { select: { amount: true } }, groups: { include: { group: { include: { course: true } } } } } } },
        orderBy: { student: { name: "asc" } },
      },
    },
  });
  if (!group) notFound();

  const days = lessonDates(group.days, year, month);
  const range = { gte: days[0] ?? new Date(), lte: days.at(-1) ?? new Date() };
  const [attendance, grades, exams, courses, teachers, rooms, others] = await Promise.all([
    db.attendance.findMany({ where: { groupId: id, date: range } }),
    db.grade.findMany({ where: { groupId: id, date: range } }),
    db.exam.findMany({ where: { groupId: id }, include: { results: true }, orderBy: { date: "asc" } }),
    db.course.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({ where: { isTeacher: true, active: true }, orderBy: { name: "asc" } }),
    db.room.findMany({ orderBy: { name: "asc" } }),
    db.student.findMany({ where: { groups: { none: { groupId: id, leftAt: null } } }, orderBy: { name: "asc" } }),
  ]);
  const mark = new Map(attendance.map((a) => [`${a.studentId}:${isoDate(a.date)}`, a.present]));
  const gradeMap = new Map(grades.map((g) => [`${g.studentId}:${isoDate(g.date)}`, g.score]));
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
            {allow.edit && <Modal title="Guruhni tahrirlash" triggerClassName="btn-secondary" trigger={<><Pencil className="h-4 w-4" /> Tahrirlash</>}>
              <form action={updateGroup.bind(null, group.id)} className="space-y-3">
                <GroupFields courses={courses} teachers={teachers} rooms={rooms} g={group} />
                <SubmitRow />
              </form>
            </Modal>}
            {allow.remove && (
              <form action={deleteGroup.bind(null, group.id)}>
                <button className="btn-secondary text-rose-600"><Trash2 className="h-4 w-4" /> O&apos;chirish</button>
              </form>
            )}
          </div>
        </div>
        <div className={`mt-4 grid gap-3 text-sm ${group.assistant ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
          <Info k="O'qituvchi" v={group.teacher?.name ?? "—"} />
          {group.assistant && <Info k="Yordamchi o'qituvchi" v={group.assistant.name} />}
          <Info k="Jadval" v={`${GROUP_DAYS[group.days]} · ${group.time}`} />
          <Info k="Xona" v={group.room?.name ?? "—"} />
          <Info k="Boshlangan" v={date(group.startDate)} />
        </div>
      </div>

      <div className="card mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 pt-3">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`/groups/${id}?tab=${t.key}${m ? `&m=${m}` : ""}`}
                className={`border-b-2 px-3 py-2.5 text-sm font-medium ${tab === t.key ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2 pb-2">
            {tab !== "exams" && (
              <>
                <Link href={`/groups/${id}?tab=${tab}&m=${ym(prev)}`} className="btn-secondary px-2"><ChevronLeft className="h-4 w-4" /></Link>
                <span className="w-32 text-center text-sm font-medium">{MONTHS[month]} {year}</span>
                <Link href={`/groups/${id}?tab=${tab}&m=${ym(next)}`} className="btn-secondary px-2"><ChevronRight className="h-4 w-4" /></Link>
              </>
            )}
            {tab === "exams" && allow.grades && group.students.length > 0 && (
              <Modal title="Imtihon natijalari" trigger={<><Plus className="h-4 w-4" /> Imtihon</>}>
                <form action={createExam.bind(null, id)} className="space-y-3">
                  <Field label="Imtihon nomi"><input name="title" className="input" required placeholder="1-modul yakuniy imtihoni" /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Sana"><input name="date" type="date" className="input" defaultValue={isoDate(new Date())} /></Field>
                    <Field label="Maksimal ball"><input name="maxScore" type="number" min={1} className="input" defaultValue={100} /></Field>
                  </div>
                  <div className="max-h-[45vh] space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                    {group.students.map(({ student }) => (
                      <label key={student.id} className="flex items-center justify-between gap-3 text-sm">
                        <span>{student.name}</span>
                        <input name={`score_${student.id}`} type="number" min={0} className="input w-24" placeholder="ball" />
                      </label>
                    ))}
                  </div>
                  <SubmitRow />
                </form>
              </Modal>
            )}
            {allow.students && <Modal title="O'quvchi qo'shish" trigger={<><Plus className="h-4 w-4" /> O&apos;quvchi</>}>
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
            </Modal>}
          </div>
        </div>

        {tab === "attendance" && allow.attendance && <p className="px-5 pt-3 text-xs text-slate-500">Katakchani bosing: <span className="text-emerald-600">✓ keldi</span> → <span className="text-rose-600">✗ kelmadi</span> → bo&apos;sh</p>}
        {tab === "grades" && <p className="px-5 pt-3 text-xs text-slate-500">Har bir dars uchun 1–5 baho. {allow.grades ? "Katakchani bosib baho tanlang." : ""}</p>}

        {tab !== "exams" ? (
          <div className="overflow-x-auto pt-2">
            <table className="table">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-48 bg-slate-50">O&apos;quvchi</th>
                  {tab === "attendance" && allow.balance && <th>Balans</th>}
                  <th className="text-center">{tab === "attendance" ? "Davomat" : "O'rtacha"}</th>
                  {days.map((d) => (
                    <th key={d.toISOString()} className={`px-1 text-center ${isoDate(d) === today ? "text-brand-600" : ""}`}>{d.getUTCDate()}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {group.students.map(({ student }) => {
                  const b = balance(student.groups, student.payments);
                  const marks = days.map((d) => mark.get(`${student.id}:${isoDate(d)}`)).filter((v) => v !== undefined);
                  const scores = days.map((d) => gradeMap.get(`${student.id}:${isoDate(d)}`)).filter((v): v is number => v !== undefined);
                  return (
                    <tr key={student.id}>
                      <td className="sticky left-0 z-10 bg-white">
                        <Link href={`/students/${student.id}`} className="font-medium hover:text-brand-600">{student.name}</Link>
                        <p className="text-xs text-slate-500">{student.phone}</p>
                      </td>
                      {tab === "attendance" && allow.balance && <td><BalanceBadge value={b} label={money(b)} /></td>}
                      <td className="text-center font-semibold">
                        {tab === "attendance"
                          ? (marks.length ? `${Math.round((marks.filter(Boolean).length / marks.length) * 100)}%` : "—")
                          : (scores.length ? (scores.reduce((x, y) => x + y, 0) / scores.length).toFixed(1) : "—")}
                      </td>
                      {days.map((d) => {
                        const key = isoDate(d);
                        if (tab === "grades") {
                          return (
                            <td key={key} className="px-1 text-center">
                              <GradeCell groupId={id} studentId={student.id} day={key} value={gradeMap.get(`${student.id}:${key}`)} editable={allow.grades} />
                            </td>
                          );
                        }
                        const v = mark.get(`${student.id}:${key}`);
                        return (
                          <td key={key} className="px-1 text-center">
                            <form action={toggleAttendance.bind(null, id, student.id, key)}>
                              <button
                                disabled={!allow.attendance}
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
                        {allow.students && <form action={removeStudentFromGroup.bind(null, id, student.id)}>
                          <button className="text-xs text-rose-600 hover:underline">Chiqarish</button>
                        </form>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {group.students.length === 0 && <Empty text="Guruhda o'quvchi yo'q" />}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-48 bg-slate-50">O&apos;quvchi</th>
                  <th className="text-center">O&apos;rtacha</th>
                  {exams.map((e) => (
                    <th key={e.id} className="text-center normal-case">
                      <div className="flex items-center justify-center gap-1">
                        <span title={e.title} className="max-w-32 truncate">{e.title}</span>
                        {allow.grades && (
                          <form action={deleteExam.bind(null, e.id)}>
                            <button className="text-slate-400 hover:text-rose-600" aria-label="Imtihonni o'chirish"><Trash2 className="h-3.5 w-3.5" /></button>
                          </form>
                        )}
                      </div>
                      <div className="font-normal text-slate-400">{date(e.date)} · {e.maxScore} ball</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.students.map(({ student }) => {
                  const pcts = exams.flatMap((e) => {
                    const r = e.results.find((x) => x.studentId === student.id);
                    return r ? [(r.score / e.maxScore) * 100] : [];
                  });
                  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
                  return (
                    <tr key={student.id}>
                      <td className="sticky left-0 z-10 bg-white font-medium">{student.name}</td>
                      <td className="text-center font-semibold">{avg === null ? "—" : <ScoreBadge pct={avg} />}</td>
                      {exams.map((e) => {
                        const r = e.results.find((x) => x.studentId === student.id);
                        return <td key={e.id} className="text-center">{r ? <>{r.score} <span className="text-xs text-slate-400">/ {e.maxScore}</span></> : <span className="text-slate-300">—</span>}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {exams.length === 0 && <Empty text="Hali imtihon o'tkazilmagan" />}
          </div>
        )}
      </div>
    </>
  );
}

const TABS = [
  { key: "attendance", label: "Davomat" },
  { key: "grades", label: "Baholar" },
  { key: "exams", label: "Imtihonlar" },
];

function ScoreBadge({ pct }: { pct: number }) {
  const cls = pct >= 85 ? "bg-emerald-100 text-emerald-700" : pct >= 60 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return <span className={`badge ${cls}`}>{pct}%</span>;
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{k}</p>
      <p className="font-medium">{v}</p>
    </div>
  );
}
