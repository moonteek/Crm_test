// One-off, safe to re-run: each student's old single "Izoh" becomes their first (pinned) note.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const students = await db.student.findMany({ where: { note: { not: null } }, include: { _count: { select: { notes: true } } } });
  let made = 0;
  for (const s of students) {
    if (!s.note?.trim() || s._count.notes > 0) continue;
    await db.studentNote.create({ data: { studentId: s.id, text: s.note.trim(), pinned: true, createdAt: s.createdAt } });
    made++;
  }
  console.log(`Izohdan eslatma yaratildi: ${made}`);
}

main().finally(() => db.$disconnect());
