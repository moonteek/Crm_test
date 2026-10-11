"use client";

import { useState } from "react";
import { Field } from "./ui";

export type CourseOption = { id: number; name: string; subjects?: { id: number; name: string; months: number }[] };

/** Course select plus, when the course has subjects, where in it the group starts (subject + level). */
export function CourseStartFields({
  courses, courseId, startSubjectId, startLevel,
}: { courses: CourseOption[]; courseId?: number; startSubjectId?: number | null; startLevel?: number }) {
  const [course, setCourse] = useState<number>(courseId ?? courses[0]?.id ?? 0);
  const subjects = courses.find((c) => c.id === course)?.subjects ?? [];
  const options = subjects.flatMap((s) => Array.from({ length: s.months }, (_, i) => ({ value: `${s.id}:${i + 1}`, label: `${s.name} · ${i + 1}-daraja` })));
  const initial = startSubjectId && course === courseId ? `${startSubjectId}:${startLevel ?? 1}` : options[0]?.value ?? "";
  const [start, setStart] = useState(initial);
  const valid = options.some((o) => o.value === start) ? start : options[0]?.value ?? "";
  const [subjectId, level] = valid ? valid.split(":") : ["", "1"];

  return (
    <>
      <Field label="Kurs">
        <select name="courseId" className="input" required value={course} onChange={(e) => setCourse(Number(e.target.value))}>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      {options.length > 0 ? (
        <Field label="Qaysi fandan boshlaydi">
          <select className="input" value={valid} onChange={(e) => setStart(e.target.value)}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      ) : (
        <p className="self-end pb-2.5 text-xs text-muted">Bu kursga fanlar kiritilmagan</p>
      )}
      <input type="hidden" name="startSubjectId" value={subjectId} />
      <input type="hidden" name="startLevel" value={level} />
    </>
  );
}
