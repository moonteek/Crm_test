import { Pencil, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { Empty, Field, PageHeader, SubmitRow } from "@/components/ui";
import { createCourse, updateCourse } from "../actions";

type C = { name: string; price: number; durationMon: number; lessonMin: number; description: string | null };

function CourseFields({ c }: { c?: C }) {
  return (
    <>
      <Field label="Kurs nomi"><input name="name" className="input" required defaultValue={c?.name} placeholder="Frontend dasturlash" /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Oylik narx"><input name="price" type="number" className="input" required defaultValue={c?.price} /></Field>
        <Field label="Davomiyligi (oy)"><input name="durationMon" type="number" className="input" defaultValue={c?.durationMon ?? 6} /></Field>
        <Field label="Dars (daqiqa)"><input name="lessonMin" type="number" className="input" defaultValue={c?.lessonMin ?? 90} /></Field>
      </div>
      <Field label="Tavsif"><textarea name="description" className="input" rows={3} defaultValue={c?.description ?? ""} /></Field>
    </>
  );
}

export default async function CoursesPage() {
  const courses = await db.course.findMany({
    include: { groups: { where: { status: "ACTIVE" }, include: { _count: { select: { students: { where: { leftAt: null } } } } } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Kurslar" subtitle={`${courses.length} ta kurs`}>
        <Modal title="Yangi kurs" trigger={<><Plus className="h-4 w-4" /> Kurs qo&apos;shish</>}>
          <form action={createCourse} className="space-y-3"><CourseFields /><SubmitRow /></form>
        </Modal>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((c) => (
          <div key={c.id} className="card flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold">{c.name}</h3>
              <Modal title="Kursni tahrirlash" triggerClassName="text-slate-400 hover:text-brand-600" trigger={<Pencil className="h-4 w-4" />}>
                <form action={updateCourse.bind(null, c.id)} className="space-y-3"><CourseFields c={c} /><SubmitRow /></form>
              </Modal>
            </div>
            <p className="mt-1 flex-1 text-sm text-slate-500">{c.description}</p>
            <p className="mt-4 text-xl font-bold text-brand-600">{money(c.price)}<span className="text-sm font-normal text-slate-500"> / oy</span></p>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <span className="badge bg-slate-100">{c.durationMon} oy</span>
              <span className="badge bg-slate-100">{c.lessonMin} daqiqa</span>
              <span className="badge bg-brand-50 text-brand-700">{c.groups.length} guruh</span>
              <span className="badge bg-emerald-50 text-emerald-700">{c.groups.reduce((s, g) => s + g._count.students, 0)} o&apos;quvchi</span>
            </div>
          </div>
        ))}
      </div>
      {courses.length === 0 && <div className="card"><Empty text="Kurslar yo'q" /></div>}
    </>
  );
}
