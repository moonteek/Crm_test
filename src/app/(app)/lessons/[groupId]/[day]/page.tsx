import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can, groupScope } from "@/lib/access";
import { db } from "@/lib/db";
import { canCover } from "@/lib/cover-db";
import { centreDay } from "@/lib/membership-db";
import { closedDaysOf, makeupDaysOf } from "@/lib/holidays-db";
import { lessonOpenOn } from "@/lib/lesson-changes";
import { lessonWeekdays } from "@/lib/format";
import { TodayLesson } from "@/components/TodayLesson";
import { GradeCell } from "@/components/GradeCell";
import { PageHeader } from "@/components/ui";

/**
 * One lesson of one group, today: marks, absence reasons and daily grades — for the person covering it (a substitute
 * or the make-up teacher) on that day only. The group's own staff are sent to the group page.
 */
export default async function LessonPage({ params }: { params: Promise<{ groupId: string; day: string }> }) {
  const user = await requireUser();
  const { groupId: raw, day } = await params;
  const groupId = Number(raw);
  if (!Number.isInteger(groupId) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) notFound();
  const own = can(user, "groups.view") && (await db.group.count({ where: { id: groupId, ...groupScope(user) } })) > 0;
  if (own) redirect(`/groups/${groupId}`);
  if (!(await canCover(user, groupId, day))) redirect("/no-access");

  const date = centreDay();
  const group = await db.group.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      room: true,
      students: { where: { leftAt: null, status: { in: ["ACTIVE", "TRIAL"] } }, include: { student: { select: { id: true, name: true } } }, orderBy: { student: { name: "asc" } } },
    },
  });
  const [closed, makeups, marks, grades, reasons, makeup] = await Promise.all([
    closedDaysOf(), makeupDaysOf(),
    db.attendance.findMany({ where: { groupId, date } }),
    db.grade.findMany({ where: { groupId, date } }),
    db.absenceReason.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.lessonChange.findFirst({ where: { groupId, kind: "CANCEL", makeupDate: date }, include: { makeupRoom: true } }),
  ]);
  const open = lessonOpenOn(day, { noLesson: closed(groupId), extra: makeups(groupId), weekdayLesson: lessonWeekdays(group.days).includes(date.getUTCDay()) });
  const time = makeup?.makeupTime ?? group.time;
  const room = makeup ? makeup.makeupRoom?.name ?? null : group.room?.name ?? null;
  const rows = group.students.map((gs) => {
    const a = marks.find((m) => m.studentId === gs.student.id);
    return { id: gs.student.id, name: gs.student.name, mark: (a ? (a.late ? "late" : a.present ? "present" : "absent") : null) as "present" | "late" | "absent" | null, reasonId: a?.reasonId ?? null };
  });

  return (
    <>
      <PageHeader title={group.name} subtitle={`${makeup ? "Qo'shimcha dars" : "O'rinbosar darsi"} · ${day.split("-").reverse().join(".")} · ${time}${room ? ` · ${room}` : ""}`} />
      {!open ? (
        <p className="card p-4 text-sm text-muted">Bugun bu guruhda dars yo&apos;q (bekor qilingan yoki bayram).</p>
      ) : (
        <>
          <TodayLesson
            groupId={groupId} day={day} rows={rows} editable={can(user, "attendance.mark")}
            reasons={reasons.map((r) => ({ id: r.id, name: r.name }))} substitute={null}
          />
          <section className="card mt-4 p-4 md:mt-6 md:p-5" aria-label="Baholar">
            <h2 className="mb-3 font-semibold">Baholar</h2>
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate">{r.name}</span>
                  <GradeCell groupId={groupId} studentId={r.id} day={day} value={grades.find((g) => g.studentId === r.id)?.score} editable={can(user, "grades.manage")} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
