// Moving to course sections (2026-10-21): the one-off conversion plan and the rule that keeps level numbers stable.

type ConversionInput = {
  courses: { id: number; name: string; sections: { id: number }[] }[];
  subjects: { id: number; courseId: number; sectionId: number | null; months: number; levels: number }[];
  groups: { id: number; courseId: number; sectionId: number | null }[];
};

/**
 * What `npm run db:curriculum-v2` does: a section named after every course that has none; every subject without a
 * section goes to its course's first section with `levels = months` (one month was one level of ~13 lessons); every
 * group without a section gets its course's first section. Already-converted rows are left alone, so it can run again.
 */
export function planConversion(d: ConversionInput) {
  return {
    newSections: d.courses.filter((c) => c.sections.length === 0).map((c) => ({ courseId: c.id, name: c.name })),
    subjects: d.subjects.filter((s) => s.sectionId === null).map((s) => ({ id: s.id, courseId: s.courseId, levels: Math.max(1, s.months) })),
    groups: d.groups.filter((g) => g.sectionId === null).map((g) => ({ id: g.id, courseId: g.courseId })),
  };
}

export type LineShape = { id: number; position: number; levels: number };

const REFUSED = "Bu bo'limda daraja imtihoni baholangan — darajalar tartibi va sonini o'zgartirib bo'lmaydi (nomini va dars sonini o'zgartirish mumkin)";

/**
 * Level exams are numbered by their place in the section, so once one is scored the existing lines must keep their
 * order and level counts; new lines may only be added after the last one. Null = allowed.
 */
export function structureProblem(before: LineShape[], after: LineShape[], scored: boolean): string | null {
  if (!scored) return null;
  const order = (xs: LineShape[]) => [...xs].sort((a, b) => a.position - b.position);
  const was = order(before);
  const now = order(after);
  // the old lines, in order, must open the new list unchanged; anything else may only follow them
  for (const [i, old] of was.entries()) {
    const x = now[i];
    if (!x || x.id !== old.id || x.levels !== old.levels) return REFUSED;
  }
  return null;
}
