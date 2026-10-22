// One-off, safe to re-run (2026-10-22): the old single "Ota-ona" name/phone becomes "Otasi" where Otasi is empty.
import { PrismaClient } from "@prisma/client";
import { planParents } from "../src/lib/student-contacts";

const db = new PrismaClient();

async function main() {
  const rows = await db.student.findMany({ select: { id: true, parentName: true, parentPhone: true, fatherName: true, fatherPhone: true } });
  const plan = planParents(rows);
  await db.$transaction(plan.map((p) => db.student.update({ where: { id: p.id }, data: { fatherName: p.fatherName, fatherPhone: p.fatherPhone } })));
  console.log(`Ota-ona: ${plan.length} ta o'quvchida "Otasi" to'ldirildi`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
