import { test } from "node:test";
import assert from "node:assert/strict";
import { enqueue, flush, TelegramError, type QueueRow, type QueueStore, type TelegramClient } from "./telegram-queue";

/** An in-memory store with the same rules as the database one. */
function memoryStore(users: Record<number, { chatId: string | null; active: boolean }>) {
  const rows: (QueueRow & { status: string; error: string | null; chatId: string | null; claimedAt?: Date })[] = [];
  const store: QueueStore = {
    async insertNew(msgs, now) {
      let n = 0;
      for (const m of msgs) if (!rows.some((r) => r.key === m.key)) { rows.push({ id: rows.length + 1, ...m, tries: 0, createdAt: now, status: "PENDING", error: null, chatId: null }); n++; }
      return n;
    },
    async pending() { return rows.filter((r) => r.status === "PENDING"); },
    async claim(id, at) { const r = rows.find((x) => x.id === id)!; if (r.status !== "PENDING") return false; r.status = "SENDING"; r.claimedAt = at; return true; },
    async stuck(before) { return rows.filter((r) => r.status === "SENDING" && r.claimedAt! < before).map((r) => r.id); },
    async recipient(userId) { return users[userId] ?? null; },
    async markSent(id, chatId) { const r = rows.find((x) => x.id === id)!; r.status = "SENT"; r.chatId = chatId; },
    async markFailed(id, error, final) { const r = rows.find((x) => x.id === id)!; r.tries++; r.error = error; r.status = final ? "FAILED" : "PENDING"; },
    async unlink(userId) { users[userId].chatId = null; },
  };
  return { store, rows };
}

function fakeClient(fail?: (n: number) => TelegramError | null) {
  const sent: { chatId: string; text: string }[] = [];
  let calls = 0;
  const client: TelegramClient = {
    async sendMessage(chatId, text) {
      const err = fail?.(++calls);
      if (err) throw err;
      sent.push({ chatId, text });
    },
    async getUpdates() { return []; },
    async getMe() { return { username: "test_bot" }; },
  };
  return { client, sent };
}

const now = new Date("2026-10-15T04:00:00Z");
const msg = { key: "reminder:6:2026-10-15:10", userId: 10, text: "Salom" };

test("a message is stored once by key and sent once", async () => {
  const { store, rows } = memoryStore({ 10: { chatId: "555", active: true } });
  assert.equal(await enqueue(store, [msg], now), 1);
  assert.equal(await enqueue(store, [msg], now), 0);
  const { client, sent } = fakeClient();
  await flush(store, client, now);
  await flush(store, client, now);
  assert.deepEqual(sent, [{ chatId: "555", text: "Salom" }]);
  assert.equal(rows[0].status, "SENT");
});

test("a failing send is retried, then marked failed after 3 tries", async () => {
  const { store, rows } = memoryStore({ 10: { chatId: "555", active: true } });
  await enqueue(store, [msg], now);
  const { client } = fakeClient(() => new TelegramError(500, "Internal Server Error"));
  await flush(store, client, now);
  assert.equal(rows[0].status, "PENDING");
  assert.equal(rows[0].tries, 1);
  await flush(store, client, now);
  await flush(store, client, now);
  assert.equal(rows[0].status, "FAILED");
  assert.equal(rows[0].error, "Internal Server Error");
});

test("the person blocked the bot (403): failed at once and unlinked", async () => {
  const users = { 10: { chatId: "555", active: true } };
  const { store, rows } = memoryStore(users);
  await enqueue(store, [msg], now);
  await flush(store, fakeClient(() => new TelegramError(403, "Forbidden: bot was blocked by the user")).client, now);
  assert.equal(rows[0].status, "FAILED");
  assert.equal(rows[0].tries, 1);
  assert.equal(users[10].chatId, null);
});

test("unlinked or blocked after the message was queued: they get nothing", async () => {
  for (const later of [{ chatId: null, active: true }, { chatId: "555", active: false }]) {
    const users: Record<number, { chatId: string | null; active: boolean }> = { 10: { chatId: "555", active: true } };
    const { store, rows } = memoryStore(users);
    await enqueue(store, [msg], now);
    users[10] = later;
    const { client, sent } = fakeClient();
    await flush(store, client, now);
    assert.deepEqual(sent, []);
    assert.equal(rows[0].status, "FAILED");
    assert.equal(rows[0].error, "Telegram ulanmagan");
  }
});

test("a message stuck for over 2 hours is dropped, not sent late", async () => {
  const { store, rows } = memoryStore({ 10: { chatId: "555", active: true } });
  await enqueue(store, [msg], new Date(now.getTime() - 3 * 3600_000));
  const { client, sent } = fakeClient();
  await flush(store, client, now);
  assert.deepEqual(sent, []);
  assert.equal(rows[0].status, "FAILED");
  assert.equal(rows[0].error, "Kechikdi");
});

test("two senders at once: only one sends", async () => {
  const { store } = memoryStore({ 10: { chatId: "555", active: true } });
  await enqueue(store, [msg], now);
  const { client, sent } = fakeClient();
  await Promise.all([flush(store, client, now), flush(store, client, now)]);
  assert.equal(sent.length, 1);
});

test("recording a sent message fails: it is never sent again, and later shows as failed", async () => {
  const { store, rows } = memoryStore({ 10: { chatId: "555", active: true } });
  await enqueue(store, [msg], now);
  const markSent = store.markSent;
  store.markSent = async () => { throw new Error("database is locked"); };
  const { client, sent } = fakeClient();
  await flush(store, client, now).catch(() => {});
  store.markSent = markSent;
  await flush(store, client, now);
  assert.equal(sent.length, 1);
  assert.equal(rows[0].status, "SENDING");
  // a message claimed but never resolved (crash, lock) becomes FAILED after 10 minutes — never resent
  await flush(store, client, new Date(now.getTime() + 11 * 60_000));
  assert.equal(rows[0].status, "FAILED");
  assert.equal(sent.length, 1);
});

test("messages for staff without a linked Telegram aren't even queued", async () => {
  const { store, rows } = memoryStore({ 10: { chatId: null, active: true }, 11: { chatId: "556", active: false } });
  assert.equal(await enqueue(store, [msg, { ...msg, key: "k2", userId: 11 }], now), 0);
  assert.equal(rows.length, 0);
});
