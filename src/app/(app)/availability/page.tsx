import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { DAY_TYPE_SHORT, DAY_TYPES, HOURS, teacherGrid, todayDayType, type DayType } from "@/lib/availability";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";
import { PageHeader, Segmented } from "@/components/ui";
import { lessonsFrom } from "@/lib/availability";
import { centreDay } from "@/lib/membership-db";

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ teacher?: string; d?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const asked = Number(params.teacher) || user.id;
  const own = asked === user.id;
  if (own && !user.isTeacher) redirect(can(user, "teachers.view") ? "/teachers" : "/no-access");
  if (!own && !can(user, "teachers.view")) redirect("/no-access");
  const teacher = await db.user.findFirst({ where: { id: asked, isTeacher: true, active: true } });
  if (!teacher) notFound();
  const canEdit = (own && user.isTeacher) || can(user, "groups.manage");
  const day: DayType = DAY_TYPES.includes(params.d as DayType) ? (params.d as DayType) : todayDayType();

  const [groups, slots] = await Promise.all([
    db.group.findMany({ where: { status: "ACTIVE", OR: [{ teacherId: asked }, { assistantId: asked }] }, include: { course: { select: { lessonMin: true } }, schedules: true } }),
    db.teacherSlot.findMany({ where: { userId: asked } }),
  ]);
  // this week's lessons and any schedule change still to come
  const grid = teacherGrid(asked, groups.flatMap((g) => lessonsFrom(g, centreDay())), slots)[day];
  const cells = HOURS.map((h) => ({ hour: h, cell: grid.get(h)! }));
  const count = (s: string) => cells.filter((c) => c.cell.state === s).length;
  const href = (d: DayType) => `/availability?d=${d}${own ? "" : `&teacher=${asked}`}`;

  return (
    <>
      {!own && <Link href="/teachers" className="label-mono hover:text-ink">← O&apos;qituvchilar</Link>}
      <PageHeader
        eyebrow={own ? "Haftalik vaqt" : "Vaqt jadvali"}
        title={own ? "Mening vaqtim" : teacher.name}
        subtitle={`Bo'sh: ${count("free")} soat · Band: ${count("busy")} · Dars: ${count("lesson")}`}
      >
        <Segmented options={DAY_TYPES.map((d) => ({ href: href(d), label: DAY_TYPE_SHORT[d], active: d === day }))} />
      </PageHeader>
      {canEdit && <p className="mb-3 text-sm text-muted">Soatni bosing: belgilanmagan → bo&apos;sh → band. Dars soatlari guruhlardan avtomatik olinadi.</p>}
      <AvailabilityGrid key={day} userId={asked} dayType={day} cells={cells} editable={canEdit} />
    </>
  );
}
