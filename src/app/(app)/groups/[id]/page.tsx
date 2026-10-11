import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { centreDay } from "@/lib/membership-db";
import { requirePage } from "@/lib/auth";
import { can, canSeeBalances, groupScope } from "@/lib/access";
import { balance, priceNow } from "@/lib/billing";
import { upcomingPrice } from "@/lib/prices";
import { membershipInclude } from "@/lib/billing-include";
import { date, GROUP_DAYS, isoDate, lessonDates, money, MONTHS } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { EditGroupDialog } from "@/components/EditGroupDialog";
import { BalanceBadge, Empty, Field, SubmitRow } from "@/components/ui";
import { CurriculumBadge, CurriculumBar } from "@/components/CurriculumBar";
import { curriculumOn, levelExams, passed } from "@/lib/curriculum";
import { LevelExamDialog } from "@/components/LevelExamDialog";
import { examColumns } from "@/lib/group-exams";
import { ExportButtons } from "@/components/ExportButtons";
import { busyMarkMessages } from "@/lib/availability";
import { GradeCell } from "@/components/GradeCell";
import { MemberMenu } from "@/components/members/MemberMenu";
import { StatusBadge, StatusLegend } from "@/components/members/StatusBadge";
import { toMemberData, toMemberGroup } from "@/components/members/types";
import { addStudentToGroup, createExam, deleteExam, deleteGroup, toggleAttendance } from "../../actions";

export default async function GroupPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string; tab?: string; warn?: string }> }) {
  const user = await requirePage("groups.view");
  const allow = {
    edit: can(user, "groups.manage"),
    remove: can(user, "groups.delete"),
    students: can(user, "students.manage"),
    attendance: can(user, "attendance.mark"),
    grades: can(user, "grades.manage"),
    balance: canSeeBalances(user),
    pay: can(user, "payments.create"),
  };
  const id = Number((await params).id);
  const { m, tab: tabParam, warn } = await searchParams;
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam! : "attendance";
  const now = new Date();
  const [year, month] = m ? m.split("-").map(Number).map((v, i) => (i === 1 ? v - 1 : v)) : [now.getFullYear(), now.getMonth()];

  const group = await db.group.findFirst({
    where: { id, ...groupScope(user) },
    include: {
      course: { include: { subjects: { orderBy: { position: "asc" } } } }, teacher: true, assistant: true, room: true, prices: true,
      students: {
        where: { leftAt: null },
        include: { events: membershipInclude.events, student: { include: { payments: { select: { amount: true } }, groups: { include: membershipInclude } } } },
        orderBy: { student: { name: "asc" } },
      },
    },
  });
  if (!group) notFound();

  const days = lessonDates(group.days, year, month);
  const range = { gte: days[0] ?? new Date(), lte: days.at(-1) ?? new Date() };
  const [attendance, grades, exams, courses, teachers, rooms, others, reasons, transferGroups] = await Promise.all([
    db.attendance.findMany({ where: { groupId: id, date: range } }),
    db.grade.findMany({ where: { groupId: id, date: range } }),
    db.exam.findMany({ where: { groupId: id }, include: { results: true }, orderBy: { date: "asc" } }),
    db.course.findMany({ orderBy: { name: "asc" }, include: { subjects: { orderBy: { position: "asc" } } } }),
    db.user.findMany({ where: { isTeacher: true, active: true }, orderBy: { name: "asc" } }),
    db.room.findMany({ orderBy: { name: "asc" } }),
    db.student.findMany({ where: { groups: { none: { groupId: id, leftAt: null } } }, orderBy: { name: "asc" } }),
    db.reason.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.group.findMany({ where: { status: "ACTIVE", NOT: { id }, ...groupScope(user) }, select: { id: true, name: true, days: true, price: true, course: { select: { name: true, price: true } }, prices: { select: { price: true, from: true } } }, orderBy: { name: "asc" } }),
  ]);
  const thisGroup = { id: group.id, name: group.name, days: group.days, price: group.price, course: group.course, prices: group.prices };
  const upcoming = upcomingPrice(group.prices, now);
  const cur = curriculumOn(group, group.course.subjects, centreDay());
  // just opened (?warn=1): hours its teacher / assistant marked as busy, worked out here — never text from the link
  const people = [group.teacher, group.assistant].filter((p): p is NonNullable<typeof p> => p !== null);
  const busyWarnings = warn && people.length
    ? busyMarkMessages(
        { ...group, minutes: group.course.lessonMin },
        await db.teacherSlot.findMany({ where: { userId: { in: people.map((p) => p.id) } } }),
        new Map(people.map((p) => [p.id, p.name])),
      )
    : [];
  const autoExams = levelExams(group, group.course.subjects);
  const examCols = examColumns(group, group.course.subjects, exams, centreDay());
  const mark = new Map(attendance.map((a) => [`${a.studentId}:${isoDate(a.date)}`, a.present]));
  const gradeMap = new Map(grades.map((g) => [`${g.studentId}:${isoDate(g.date)}`, g.score]));
  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);
  const ym = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}`;
  const today = isoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));

  return (
    <>
      <Link href="/groups" className="label-mono hover:text-ink">← Guruhlar</Link>
      {busyWarnings.length > 0 && <p className="mt-3 rounded-xl bg-warning-tint px-4 py-3 text-sm text-warning">Guruh ochildi. {busyWarnings.join("; ")}</p>}
      <div className="card mt-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{group.name}</h1>
              <CurriculumBadge progress={cur.progress} level={group.level} />
              {group.status === "FINISHED" && <span className="badge bg-ink/5 text-muted">Tugagan</span>}
            </div>
            <p className="mt-1 text-muted">{group.course.name} · {money(priceNow(group))} / oy{upcoming && <span className="label-mono ml-2">{date(upcoming.from)} dan: {money(upcoming.price)}</span>}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {allow.edit && <EditGroupDialog group={group} courses={courses} teachers={teachers} rooms={rooms} />}
            {allow.remove && (
              <form action={deleteGroup.bind(null, group.id)}>
                <button className="btn-danger"><Trash2 className="h-4 w-4" /> O&apos;chirish</button>
              </form>
            )}
          </div>
        </div>
        <div className={`mt-5 grid grid-cols-2 gap-2.5 text-sm ${group.assistant ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
          <Info k="O'qituvchi" v={group.teacher?.name ?? "—"} />
          {group.assistant && <Info k="Yordamchi o'qituvchi" v={group.assistant.name} />}
          <Info k="Jadval" v={`${GROUP_DAYS[group.days]} · ${group.time}`} />
          <Info k="Xona" v={group.room?.name ?? "—"} />
          <Info k="Boshlangan" v={date(group.startDate)} />
        </div>
        {cur.windows.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <CurriculumBar windows={cur.windows} progress={cur.progress} />
            {cur.nextExam && <p className="label-mono mt-3">Keyingi imtihon: {cur.nextExam.title} · {date(cur.nextExam.date)}</p>}
          </div>
        )}
      </div>

      <div className="card mt-4 md:mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 pt-3">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`/groups/${id}?tab=${t.key}${m ? `&m=${m}` : ""}`}
                className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${tab === t.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-2">
            {/* last in the row, so the month switcher stays together */}
            <div className="order-last"><ExportButtons href={`/groups/${id}/export`} extra={{ tab, m: `${year}-${month + 1}` }} /></div>
            {tab !== "exams" && (
              <>
                <Link href={`/groups/${id}?tab=${tab}&m=${ym(prev)}`} className="btn-secondary px-2"><ChevronLeft className="h-4 w-4" /></Link>
                <span className="w-32 text-center text-sm font-medium">{MONTHS[month]} <span className="font-mono text-muted">{year}</span></span>
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
                  <div className="max-h-[45vh] space-y-2 overflow-y-auto rounded-lg border border-line p-3">
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
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Holati">
                    <select name="mode" className="input" defaultValue="TRIAL">
                      <option value="TRIAL">Sinov darsi (bepul)</option>
                      <option value="ACTIVE">Faol (to&apos;lovli)</option>
                    </select>
                  </Field>
                  <Field label="Qaysi kundan"><input type="date" name="joinedAt" className="input" defaultValue={isoDate(centreDay())} /></Field>
                </div>
                <SubmitRow />
              </form>
            </Modal>}
          </div>
        </div>

        {tab === "attendance" && allow.attendance && <p className="px-5 pt-3 text-xs text-muted">Katakchani bosing: <span className="text-success">✓ keldi</span> → <span className="text-danger">✗ kelmadi</span> → bo&apos;sh</p>}
        <div className="px-5 pt-3"><StatusLegend /></div>
        {tab === "grades" && <p className="px-5 pt-3 text-xs text-muted">Har bir dars uchun 1–5 baho. {allow.grades ? "Katakchani bosib baho tanlang." : ""}</p>}

        {tab !== "exams" ? (
          <div className="overflow-x-auto pt-2">
            <table className="table">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-48 bg-surface">O&apos;quvchi</th>
                  {tab === "attendance" && allow.balance && <th>Balans</th>}
                  <th className="text-center">{tab === "attendance" ? "Davomat" : "O'rtacha"}</th>
                  {days.map((d) => (
                    <th key={d.toISOString()} className={`px-1 text-center ${isoDate(d) === today ? "text-accent-ink" : ""}`}>{d.getUTCDate()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.students.map((gs) => {
                  const { student } = gs;
                  const b = balance(student.groups, student.payments);
                  const marks = days.map((d) => mark.get(`${student.id}:${isoDate(d)}`)).filter((v) => v !== undefined);
                  const scores = days.map((d) => gradeMap.get(`${student.id}:${isoDate(d)}`)).filter((v): v is number => v !== undefined);
                  return (
                    <tr key={student.id}>
                      <td className="sticky left-0 z-10 bg-surface">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <Link href={`/students/${student.id}`} className="font-medium hover:underline">{student.name}</Link>
                            <p className="mt-0.5 flex items-center gap-2">
                              <span className="font-mono text-xs text-faint">{student.phone}</span>
                              {gs.status !== "ACTIVE" && <StatusBadge status={gs.status} />}
                            </p>
                          </div>
                          <MemberMenu
                            member={toMemberData({ ...gs, group: thisGroup }, { id: student.id, name: student.name })}
                            reasons={reasons}
                            groups={transferGroups.map((g) => toMemberGroup(g))}
                            balance={allow.balance ? b : null}
                            canManage={allow.students}
                            canPay={allow.pay}
                          />
                        </div>
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
                                className={`press h-7 w-7 rounded-full border text-sm font-bold ${
                                  v === true ? "border-success/40 bg-success-tint text-success"
                                  : v === false ? "border-danger/40 bg-danger-tint text-danger"
                                  : "border-line bg-raised text-faint hover:border-ink"
                                }`}
                              >
                                {v === true ? "✓" : v === false ? "✗" : "·"}
                              </button>
                            </form>
                          </td>
                        );
                      })}
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
                  <th className="sticky left-0 z-10 min-w-48 bg-surface">O&apos;quvchi</th>
                  <th className="text-center">O&apos;rtacha</th>
                  {examCols.map((e) => (
                    <th key={e.key} className={`text-center normal-case ${e.upcoming ? "opacity-50" : ""}`}>
                      <div className="flex items-center justify-center gap-1">
                        {e.level !== null && <span className="badge border border-line-strong px-1.5 py-0 text-[10px] text-muted">avto</span>}
                        <span title={e.title} className="max-w-36 truncate">{e.title}</span>
                        {allow.grades && e.level !== null && !e.upcoming && (
                          <LevelExamDialog
                            groupId={id} level={e.level} title={e.title} dateLabel={date(e.date)} maxScore={e.maxScore} passPercent={group.course.passPercent}
                            students={group.students.map(({ student }) => ({ id: student.id, name: student.name, score: e.results.find((r) => r.studentId === student.id)?.score ?? null }))}
                          />
                        )}
                        {allow.grades && e.id !== null && (
                          <form action={deleteExam.bind(null, e.id)}>
                            <button className="text-faint hover:text-danger" aria-label="Imtihonni o'chirish"><Trash2 className="h-3.5 w-3.5" /></button>
                          </form>
                        )}
                      </div>
                      <div className="font-normal text-faint">{date(e.date)}{e.upcoming ? " · kutilmoqda" : ` · ${e.maxScore} ball`}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.students.map(({ student }) => {
                  const pcts = examCols.flatMap((e) => {
                    const r = e.results.find((x) => x.studentId === student.id);
                    return r ? [(r.score / e.maxScore) * 100] : [];
                  });
                  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
                  return (
                    <tr key={student.id}>
                      <td className="sticky left-0 z-10 bg-surface font-medium">{student.name}</td>
                      <td className="text-center font-semibold">{avg === null ? "—" : <ScoreBadge pct={avg} />}</td>
                      {examCols.map((e) => {
                        const r = e.results.find((x) => x.studentId === student.id);
                        if (!r) return <td key={e.key} className="text-center text-faint">—</td>;
                        const failed = !passed(r.score, e.maxScore, group.course.passPercent);
                        return (
                          <td key={e.key} className={`text-center ${failed ? "text-danger" : ""}`}>
                            {r.score} <span className={`text-xs ${failed ? "" : "text-faint"}`}>/ {e.maxScore}</span>
                            {failed && <div className="label-mono text-danger">yiqildi</div>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {examCols.length === 0 && <Empty text="Hali imtihon o'tkazilmagan" />}
            {autoExams.length > 0 && <p className="px-5 py-3 text-xs text-muted">Daraja imtihonlari har oyning oxirgi darsida avtomatik belgilanadi. O&apos;tish bali: {group.course.passPercent}%.</p>}
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
  const cls = pct >= 85 ? "bg-success-tint text-success" : pct >= 60 ? "bg-warning-tint text-warning" : "bg-danger-tint text-danger";
  return <span className={`badge ${cls}`}>{pct}%</span>;
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-raised p-3">
      <p className="label-mono">{k}</p>
      <p className="mt-1 truncate font-medium">{v}</p>
    </div>
  );
}
