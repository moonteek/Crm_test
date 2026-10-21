import { Pencil, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { ExportButtons } from "@/components/ExportButtons";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/access";
import { money } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { Empty, Field, PageHeader } from "@/components/ui";
import { createCourse, updateCourse } from "../actions";
import { SectionEditor } from "@/components/SectionEditor";
import { CoursePicture } from "@/components/CoursePicture";
import { courseMonths, sectionLessons, sectionLevels } from "@/lib/curriculum";
import { COURSE_COLOR_LABEL, COURSE_COLORS, COURSE_TONE, courseColor } from "@/lib/timetable";
import { ActionForm } from "@/components/ActionForm";

type C = { name: string; price: number; durationMon: number; months?: number | null; lessonMin: number; description: string | null; passPercent: number; color: string | null; image: string | null; subjects?: unknown[] };

function CourseFields({ c }: { c?: C }) {
  return (
    <>
      <Field label="Kurs nomi"><input name="name" className="input" required defaultValue={c?.name} placeholder="Frontend dasturlash" /></Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Oylik narx"><input name="price" type="number" className="input" required defaultValue={c?.price} /></Field>
        <Field label="Davomiyligi (oy)">
          <input name="durationMon" type="number" className="input" defaultValue={c?.months ?? c?.durationMon ?? 6} readOnly={!!c?.months} title={c?.months ? "Darajalar bo'yicha hisoblanadi (Bo'limlar va darajalar)" : undefined} />
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
      <CoursePicture current={c?.image} />
    </>
  );
}

export default async function CoursesPage() {
  const user = await requirePage("courses.view");
  const manage = can(user, "courses.manage");
  const courses = await db.course.findMany({
    omit: { image: false },
    include: { subjects: true, sections: { orderBy: { position: "asc" }, include: { subjects: { orderBy: { position: "asc" } } } }, groups: { where: { status: "ACTIVE" }, include: { _count: { select: { students: { where: { leftAt: null } } } } } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Kurslar" subtitle={`${courses.length} ta kurs`}>
        <ExportButtons href="/courses/export" />
        {manage && <Modal title="Yangi kurs" trigger={<><Plus className="h-4 w-4" /> Kurs qo&apos;shish</>}>
          <ActionForm action={createCourse} className="space-y-3"><CourseFields /></ActionForm>
        </Modal>}
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((c) => (
          <div key={c.id} className="card flex flex-col overflow-hidden">
            <div className={`flex h-32 items-center justify-center border-b ${COURSE_TONE[courseColor(c)].card}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from the database */}
              {c.image ? <img src={c.image} alt="" className="h-full w-full object-cover" /> : <span className={`font-dot font-black text-5xl ${COURSE_TONE[courseColor(c)].ink}`}>{c.name.charAt(0)}</span>}
            </div>
            <div className="flex flex-1 flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold">{c.name}</h3>
              {manage && <Modal title="Kursni tahrirlash" triggerClassName="text-faint hover:text-ink" trigger={<Pencil className="h-4 w-4" />}>
                <ActionForm action={updateCourse.bind(null, c.id)} className="space-y-3"><CourseFields c={{ ...c, months: courseMonths(c.sections) }} /></ActionForm>
              </Modal>}
            </div>
            <p className="mt-1 text-sm text-muted">{c.description}</p>
            <div className="mt-3 flex-1 space-y-1.5">
              {c.sections.map((sec) => (
                <div key={sec.id} className="text-sm">
                  <p>
                    <span className="font-medium">{sec.name}</span>
                    <span className="text-muted"> · {sectionLevels(sec.subjects)} daraja · {sectionLessons(sec.subjects)} dars</span>
                    {sec.price !== null && sec.price !== c.price && <span className="text-accent-ink"> · {money(sec.price)}</span>}
                  </p>
                  <p className="text-xs text-muted">{sec.subjects.map((l) => (l.levels > 1 ? `${l.name} ×${l.levels}` : l.name)).join(", ") || "Darajalar kiritilmagan"}</p>
                </div>
              ))}
              {manage && <SectionEditor courseId={c.id} courseName={c.name} coursePrice={c.price} sections={c.sections} />}
            </div>
            <p className="mt-4 text-xl font-semibold tracking-tight text-accent-ink">{money(c.price)}<span className="text-sm font-normal text-muted"> / oy</span></p>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3 text-xs text-muted">
              <span className="badge bg-ink/5">{courseMonths(c.sections) ?? c.durationMon} oy</span>
              <span className="badge bg-ink/5">{c.lessonMin} daqiqa</span>
              <span className={`badge border ${COURSE_TONE[courseColor(c)].card} ${COURSE_TONE[courseColor(c)].ink}`} title="Dars jadvalidagi rang">{COURSE_COLOR_LABEL[courseColor(c)]}</span>
              <span className="badge bg-accent-tint text-accent-ink">{c.groups.length} guruh</span>
              <span className="badge bg-success-tint text-success">{c.groups.reduce((s, g) => s + g._count.students, 0)} o&apos;quvchi</span>
            </div>
            </div>
          </div>
        ))}
      </div>
      {courses.length === 0 && <div className="card"><Empty text="Kurslar yo'q" /></div>}
    </>
  );
}
