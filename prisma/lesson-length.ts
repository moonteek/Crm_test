// One-off, safe to re-run: lessons are 2 hours, kids' courses ("bolalar") 1.5 hours.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const courses = await db.course.findMany();
  let changed = 0;
  for (const c of courses) {
    if (c.name.toLowerCase().includes("bolalar") || c.lessonMin === 120) continue;
    await db.course.update({ where: { id: c.id }, data: { lessonMin: 120 } });
    console.log(`${c.name}: ${c.lessonMin} → 120`);
    changed++;
  }
  if (!changed) console.log("o'zgarish yo'q");
}

main().finally(() => db.$disconnect());
