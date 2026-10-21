"use client";

import { useState } from "react";
import { levelLabel } from "@/lib/curriculum";
import { money } from "@/lib/format";
import { Field } from "./ui";

type SectionOption = { id: number; name: string; price: number | null; subjects: { id: number; name: string; levels: number }[] };
export type CourseOption = { id: number; name: string; price: number; sections: SectionOption[] };

/**
 * Course → section (only when the course has several) → where in the section the group starts (line + level), and the
 * group price: empty = the section's price, else the course's (shown as the hint).
 */
export function CourseStartFields({
  courses, courseId, sectionId, startSubjectId, startLevel, price,
}: { courses: CourseOption[]; courseId?: number; sectionId?: number | null; startSubjectId?: number | null; startLevel?: number; price?: number | null }) {
  const [course, setCourse] = useState<number>(courseId ?? courses[0]?.id ?? 0);
  const current = courses.find((c) => c.id === course);
  const sections = current?.sections ?? [];
  const [sectionPick, setSection] = useState<number | null>(sectionId ?? null);
  const section = sections.find((s) => s.id === sectionPick) ?? sections[0];
  const options = (section?.subjects ?? []).flatMap((s) =>
    Array.from({ length: s.levels }, (_, i) => ({ value: `${s.id}:${i + 1}`, label: levelLabel(s.name, i + 1, s.levels) })),
  );
  const initial = startSubjectId && course === courseId ? `${startSubjectId}:${startLevel ?? 1}` : options[0]?.value ?? "";
  const [start, setStart] = useState(initial);
  const valid = options.some((o) => o.value === start) ? start : options[0]?.value ?? "";
  const [subjectId, level] = valid ? valid.split(":") : ["", "1"];
  const defaultPrice = section?.price ?? current?.price ?? null;

  return (
    <>
      <Field label="Kurs">
        <select name="courseId" className="input" required value={course} onChange={(e) => { setCourse(Number(e.target.value)); setSection(null); }}>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      {sections.length > 1 ? (
        <Field label="Bo'lim">
          <select className="input" value={section?.id ?? ""} onChange={(e) => setSection(Number(e.target.value))}>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      ) : null}
      {options.length > 0 ? (
        <Field label="Qaysi darajadan boshlaydi">
          <select className="input" value={valid} onChange={(e) => setStart(e.target.value)}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      ) : (
        <p className="self-end pb-2.5 text-xs text-muted">Bu bo&apos;limga darajalar kiritilmagan</p>
      )}
      <input type="hidden" name="sectionId" value={section?.id ?? ""} />
      <input type="hidden" name="startSubjectId" value={subjectId} />
      <input type="hidden" name="startLevel" value={level} />
      <div className="col-span-2">
        <Field label={`Guruh narxi, so'm / oy (bo'sh qoldirilsa — ${section?.price != null ? "bo'lim" : "kurs"} narxi)`}>
          <input name="price" type="number" min={1} className="input" defaultValue={price ?? ""} placeholder={defaultPrice != null ? money(defaultPrice) : "Kurs narxi"} />
          <span className="mt-1 block text-xs text-muted">Narx o&apos;zgarsa, yangi narx keyingi oyning 1-sanasidan amal qiladi</span>
        </Field>
      </div>
    </>
  );
}
