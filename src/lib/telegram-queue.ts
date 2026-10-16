import type { Outgoing } from "./telegram-plan";
import { TelegramError, type TelegramClient } from "./telegram-client";

// Every message is stored once (by key) and then delivered: retried up to 3 times, dropped when too late, never sent
// to someone unlinked or blocked. The database store lives in telegram-store.ts; tests use an in-memory one.

export { TelegramError, type TelegramClient };

export type QueueRow = { id: number; key: string; userId: number; text: string; tries: number; createdAt: Date };

export type QueueStore = {
  /** stores messages whose key is new; returns how many */
  insertNew(msgs: Outgoing[], now: Date): Promise<number>;
  pending(): Promise<QueueRow[]>;
  /** takes a pending message for sending; false when another sender already has it */
  claim(id: number): Promise<boolean>;
  recipient(userId: number): Promise<{ chatId: string | null; active: boolean } | null>;
  markSent(id: number, chatId: string): Promise<void>;
  /** counts a try; `final` = give up (FAILED), else back to pending */
  markFailed(id: number, error: string, final: boolean): Promise<void>;
  unlink(userId: number): Promise<void>;
};

const MAX_TRIES = 3;
const TOO_LATE_MS = 2 * 3600_000;

export const enqueue = (store: QueueStore, msgs: Outgoing[], now = new Date()) => store.insertNew(msgs, now);

/** Sends what's waiting. Never throws for a single message: its outcome is recorded instead. */
export async function flush(store: QueueStore, client: TelegramClient, now = new Date()) {
  for (const row of await store.pending()) {
    if (!(await store.claim(row.id))) continue;
    if (now.getTime() - row.createdAt.getTime() > TOO_LATE_MS) {
      await store.markFailed(row.id, "Kechikdi", true);
      continue;
    }
    const to = await store.recipient(row.userId);
    if (!to?.chatId || !to.active) {
      await store.markFailed(row.id, "Telegram ulanmagan", true);
      continue;
    }
    try {
      await client.sendMessage(to.chatId, row.text);
      await store.markSent(row.id, to.chatId);
    } catch (e) {
      const err = e instanceof TelegramError ? e : new TelegramError(0, (e as Error).message);
      // 403: the person blocked the bot or never started it — stop trying and unlink
      if (err.status === 403) {
        await store.markFailed(row.id, err.message, true);
        await store.unlink(row.userId);
      } else {
        await store.markFailed(row.id, err.message, row.tries + 1 >= MAX_TRIES);
      }
    }
  }
}
