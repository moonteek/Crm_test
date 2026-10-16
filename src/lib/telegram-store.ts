import "server-only";
import { db } from "./db";
import type { QueueStore } from "./telegram-queue";

/** The queue in the database (TelegramMessage). */
export function prismaStore(): QueueStore {
  return {
    async insertNew(msgs, now) {
      let n = 0;
      for (const m of msgs) {
        try {
          await db.telegramMessage.create({ data: { key: m.key, userId: m.userId, text: m.text, createdAt: now } });
          n++;
        } catch (e) {
          if ((e as { code?: string }).code !== "P2002") throw e; // already queued or sent: once only
        }
      }
      return n;
    },
    pending: () => db.telegramMessage.findMany({ where: { status: "PENDING" }, orderBy: { id: "asc" }, take: 100 }),
    async claim(id, now) {
      const { count } = await db.telegramMessage.updateMany({ where: { id, status: "PENDING" }, data: { status: "SENDING", claimedAt: now } });
      return count === 1;
    },
    async stuck(before) {
      return (await db.telegramMessage.findMany({ where: { status: "SENDING", claimedAt: { lt: before } }, select: { id: true } })).map((r) => r.id);
    },
    async recipient(userId) {
      const u = await db.user.findUnique({ where: { id: userId }, select: { telegramChatId: true, active: true } });
      return u ? { chatId: u.telegramChatId, active: u.active } : null;
    },
    async markSent(id, chatId) {
      await db.telegramMessage.update({ where: { id }, data: { status: "SENT", chatId, sentAt: new Date(), error: null } });
    },
    async markFailed(id, error, final) {
      await db.telegramMessage.update({ where: { id }, data: { status: final ? "FAILED" : "PENDING", tries: { increment: 1 }, error } });
    },
    async unlink(userId) {
      await db.user.update({ where: { id: userId }, data: { telegramChatId: null } });
    },
  };
}

/** Links a chat to a staff member; a chat belongs to one person, so anyone else holding it loses it. */
export async function linkChat(userId: number, chatId: string) {
  await db.$transaction([
    db.user.updateMany({ where: { telegramChatId: chatId, NOT: { id: userId } }, data: { telegramChatId: null } }),
    db.user.update({ where: { id: userId }, data: { telegramChatId: chatId } }),
  ]);
}
