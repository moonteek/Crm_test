// Gives memberships created before statuses existed their event history, and makes sure the default
// reasons exist. Safe to run any number of times: memberships that already have events are skipped.
// Usage: npm run db:migrate-statuses
import { PrismaClient } from "@prisma/client";
import { eventsFromLegacy } from "../src/lib/membership-legacy";

export const DEFAULT_REASONS = [
  "Moliyaviy sabab", "Ta'til / safar", "Kasallik", "Boshqa kursga o'tdi", "Dars yoqmadi", "Vaqt to'g'ri kelmadi", "Boshqa",
];

export async function migrateStatuses(db: PrismaClient) {
  let reasons = 0;
  for (const name of DEFAULT_REASONS) {
    if (await db.reason.findFirst({ where: { name } })) continue;
    await db.reason.create({ data: { name } });
    reasons++;
  }
  const pending = await db.groupStudent.findMany({ where: { events: { none: {} } } });
  for (const gs of pending) {
    await db.$transaction([
      db.membershipEvent.createMany({ data: eventsFromLegacy(gs.joinedAt, gs.leftAt).map((e) => ({ ...e, groupStudentId: gs.id })) }),
      db.groupStudent.update({ where: { id: gs.id }, data: { status: gs.leftAt ? "LEFT" : "ACTIVE" } }),
    ]);
  }
  return { memberships: pending.length, reasons };
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/migrate-statuses.ts")) {
  const db = new PrismaClient();
  migrateStatuses(db)
    .then((r) => console.log(`Migrated ${r.memberships} membership(s); added ${r.reasons} reason(s).`))
    .finally(() => db.$disconnect());
}
