import { Pencil, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { ExportButtons } from "@/components/ExportButtons";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/access";
import { money } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { Empty, Field, PageHeader, SubmitRow } from "@/components/ui";
import { createCourse, updateCourse } from "../actions";
import { SubjectEditor } from "@/components/SubjectEditor";
import { COURSE_COLOR_LABEL, COURSE_COLORS, COURSE_TONE, courseColor } from "@/lib/timetable";

type C = { name: string; price: number; durationMon: number; lessonMin: number; description: string | null; passPercent: number; color: string | null; subjects?: unknown[] };

function CourseFields({ c }: { c?: C }) {
  return (
    <>
      <Field label="Kurs nomi"><input name="name" className="input" required defaultValue={c?.name} placeholder="Frontend dasturlash" /></Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Oylik narx"><input name="price" type="number" className="input" required defaultValue={c?.price} /></Field>
        <Field label="Davomiyligi (oy)">
          <input name="durationMon" type="number" className="input" defaultValue={c?.durationMon ?? 6} readOnly={!!c?.subjects?.length} title={c?.subjects?.length ? "Fanlar oylari yig'indisi" : undefined} />
        </Field>
        <Field label="Dars (daqiqa)"><input name="lessonMin" type="number" className="input" defaultValue={c?.lessonMin ?? 120} /></Field>
        <Field label="O'tish bali, %"><input name="passPercent" type="number" min={1} max={100} className="input" defaultValue={c?.passPercent ?? 60} /></Field>
      </div>
      <Field label="Rang (dars jadvalida)">
        <select name="color" className="input" defaultValue={c?.color ?? ""}>
          <option value="">Avtomatik</option>
          {COURSE_COLORS.map((k) => <option key={k} value={k}>{COURSE_COLOR_LABEL[k]}</option>)}
        </select>
      </Field>
      <Field label="Tavsif"><textarea name="description" className="input" rows={3} defaultValue={c?.description ?? ""} /></Field>
    </>
  );
}

export default async function CoursesPage() {
  const user = await requirePage("courses.view");
  const manage = can(user, "courses.manage");
  const courses = await db.course.findMany({
    include: { subjects: { orderBy: { position: "asc" } }, groups: { where: { status: "ACTIVE" }, include: { _count: { select: { students: { where: { leftAt: null } } } } } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Kurslar" subtitle={`${courses.length} ta kurs`}>
        <ExportButtons href="/courses/export" />
        {manage && <Modal title="Yangi kurs" trigger={<><Plus className="h-4 w-4" /> Kurs qo&apos;shish</>}>
          <form action={createCourse} className="space-y-3"><CourseFields /><SubmitRow /></form>
        </Modal>}
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((c) => (
          <div key={c.id} className="card flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold">{c.name}</h3>
              {manage && <Modal title="Kursni tahrirlash" triggerClassName="text-faint hover:text-ink" trigger={<Pencil className="h-4 w-4" />}>
                <form action={updateCourse.bind(null, c.id)} className="space-y-3"><CourseFields c={c} /><SubmitRow /></form>
              </Modal>}
            </div>
            <p className="mt-1 text-sm text-muted">{c.description}</p>
            <div className="mt-3 flex flex-1 flex-wrap content-start items-center gap-1.5">
              {c.subjects.map((s, i) => (
                <span key={s.id} className="badge border border-line-strong text-ink">
                  <span className="font-mono text-[10px] text-faint">{i + 1}</span> {s.name} · {s.months} oy
                </span>
              ))}
              {c.subjects.length === 0 && <span className="text-xs text-faint">Fanlar kiritilmagan</span>}
              {manage && <SubjectEditor courseId={c.id} courseName={c.name} subjects={c.subjects} />}
            </div>
            <p className="mt-4 text-xl font-semibold tracking-tight text-accent-ink">{money(c.price)}<span className="text-sm font-normal text-muted"> / oy</span></p>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3 text-xs text-muted">
              <span className="badge bg-ink/5">{c.durationMon} oy</span>
              <span className="badge bg-ink/5">{c.lessonMin} daqiqa</span>
              <span className={`badge border ${COURSE_TONE[courseColor(c)].card} ${COURSE_TONE[courseColor(c)].ink}`} title="Dars jadvalidagi rang">{COURSE_COLOR_LABEL[courseColor(c)]}</span>
              <span className="badge bg-accent-tint text-accent-ink">{c.groups.length} guruh</span>
              <span className="badge bg-success-tint text-success">{c.groups.reduce((s, g) => s + g._count.students, 0)} o&apos;quvchi</span>
            </div>
          </div>
        ))}
      </div>
      {courses.length === 0 && <div className="card"><Empty text="Kurslar yo'q" /></div>}
    </>
  );
}
