import { db } from "./db";
import type { CurrentUser } from "./access";

/** Records who did what. Never blocks the action itself if logging fails. */
export async function logAction(user: Pick<CurrentUser, "id"> | null, action: string, summary: string) {
  try {
    await db.auditLog.create({ data: { userId: user?.id ?? null, action, summary } });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

export const AUDIT_AREAS: Record<string, string> = {
  payment: "To'lovlar",
  expense: "Xarajatlar",
  salary: "Ish haqi",
  student: "O'quvchilar",
  group: "Guruhlar",
  lead: "Lidlar",
  grade: "Baholar",
  exam: "Imtihonlar",
  staff: "Xodimlar",
  role: "Rollar",
  token: "MCP tokenlar",
  course: "Kurslar",
  auth: "Kirish",
};
