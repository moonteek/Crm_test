// One-off, safe to re-run: moves the month-based curriculum to course sections (2026-10-21).
// Every course gets a section named after it, every subject-month becomes a level of 13 lessons, every group gets its
// course's first section. Level numbers stay the same, so scored level exams keep their level.
import { PrismaClient } from "@prisma/client";
import { planConversion } from "../src/lib/curriculum-convert";

const db = new PrismaClient();

async function main() {
  const [courses, subjects, groups] = await Promise.all([
    db.course.findMany({ select: { id: true, name: true, sections: { select: { id: true } } } }),
    db.subject.findMany({ select: { id: true, courseId: true, sectionId: true, months: true, levels: true } }),
    db.group.findMany({ select: { id: true, courseId: true, sectionId: true } }),
  ]);
  const plan = planConversion({ courses, subjects, groups });
  await db.$transaction(async (tx) => {
    for (const s of plan.newSections) await tx.section.create({ data: { courseId: s.courseId, name: s.name, position: 1 } });
    const firstSection = async (courseId: number) =>
      (await tx.section.findFirstOrThrow({ where: { courseId }, orderBy: { position: "asc" }, select: { id: true } })).id;
    for (const s of plan.subjects) await tx.subject.update({ where: { id: s.id }, data: { sectionId: await firstSection(s.courseId), levels: s.levels, lessons: 13 } });
    for (const g of plan.groups) await tx.group.update({ where: { id: g.id }, data: { sectionId: await firstSection(g.courseId) } });
  });
  console.log(`Kurslar: ${plan.newSections.length} bo'lim yaratildi · ${plan.subjects.length} daraja qatori · ${plan.groups.length} guruh`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
