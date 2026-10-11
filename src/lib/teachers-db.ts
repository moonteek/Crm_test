import "server-only";
import type { Prisma } from "@prisma/client";
import { checkTeacherChange, type TeacherRole } from "./teachers-history";
import { thisMonthStart } from "./prices-db";

type Tx = Prisma.TransactionClient;
const EPOCH = new Date(0);

/**
 * Records that `userId` teaches the group in `role` from `from` on. The first change also records the previous
 * person for every earlier lesson. A change dated before the latest one is refused; the same day replaces it.
 */
export async function changeTeacher(tx: Tx, groupId: number, role: TeacherRole, previous: number | null, userId: number | null, from: Date) {
  const rows = await tx.groupTeacher.findMany({ where: { groupId } });
  const error = checkTeacherChange(rows, role, from, thisMonthStart());
  if (error) throw new Error(error);
  if (!rows.some((r) => r.role === role)) await tx.groupTeacher.create({ data: { groupId, role, userId: previous, from: EPOCH } });
  await tx.groupTeacher.upsert({
    where: { groupId_role_from: { groupId, role, from } },
    create: { groupId, role, userId, from },
    update: { userId },
  });
}
