import "server-only";
import { db } from "./db";
import { can, studentScope, type CurrentUser } from "./access";
import { teacherOn } from "./teachers-history";
import { parseReceiptSettings, type ReceiptData, type ReceiptSettings } from "./receipt";

const KEY = "receipt";

export async function getReceiptSettings(): Promise<ReceiptSettings> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  return parseReceiptSettings(row?.value ?? null);
}

export async function saveReceiptSettings(s: ReceiptSettings) {
  const value = JSON.stringify(s);
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

/** Who may print receipts: staff who see or take payments. */
export const canPrintReceipts = (user: CurrentUser) => can(user, "payments.view") || can(user, "payments.create");

/** One payment as receipt data, or null when it doesn't exist or this user may not see it. */
export async function receiptDataFor(user: CurrentUser, paymentId: number): Promise<ReceiptData | null> {
  if (!canPrintReceipts(user) || !Number.isInteger(paymentId) || paymentId < 1) return null;
  const p = await db.payment.findFirst({
    where: { id: paymentId, student: studentScope(user) },
    include: {
      student: { select: { name: true } },
      user: { select: { name: true } },
      group: { select: { name: true, teacherId: true, assistantId: true, teachers: true, teacher: { select: { id: true, name: true } } } },
    },
  });
  if (!p) return null;
  // the group's teacher on the payment day (teacher history), not necessarily today's
  let teacher: string | null = null;
  if (p.group) {
    const id = teacherOn(p.group.teachers, p.group, p.date, "TEACHER");
    teacher = id === null ? null : id === p.group.teacher?.id ? p.group.teacher.name : (await db.user.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
  }
  return {
    id: p.id, date: p.date, recordedAt: p.createdAt, student: p.student.name, teacher, taker: p.user?.name ?? null,
    group: p.group?.name ?? null, month: p.month, method: p.method, amount: p.amount,
  };
}
