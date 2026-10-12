// One-off, safe to re-run: the starting list of absence reasons (Settings → Sabablar lets admins change it).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const START = [
  ["Kasal", "amber"],
  ["Maktab / Univer sababli", "green"],
  ["Oilaviy sabab", "grey"],
  ["Sababsiz", "red"],
  ["Ish sabab", "grey"],
  ["Boshqa", "grey"],
  ["Bog'lanib bo'lmadi", "orange"],
] as const;

async function main() {
  let made = 0;
  for (const [name, color] of START) {
    if (await db.absenceReason.findUnique({ where: { name } })) continue;
    await db.absenceReason.create({ data: { name, color } });
    made++;
  }
  console.log(`Kelmaganlik sabablari qo'shildi: ${made}`);
}

main().finally(() => db.$disconnect());
