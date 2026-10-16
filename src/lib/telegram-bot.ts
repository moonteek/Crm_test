import "server-only";
import { db } from "./db";
import { closedDaysOf } from "./holidays-db";
import { centreDay } from "./membership-db";
import { parsePermissions } from "./permissions";
import { lessonsPassed } from "./timetable";
import { dueMessages, linkReply, type Outgoing } from "./telegram-plan";
import { enqueue, flush } from "./telegram-queue";
import { TelegramError, telegramClient, type TelegramClient, type Update } from "./telegram-client";
import { linkChat, prismaStore } from "./telegram-store";

// The centre's Telegram bot, inside the CRM server: long-polls for Start / shared contacts, and every minute queues
// due reminders and nudges and sends what's waiting. Runs only when TELEGRAM_BOT_TOKEN is set (see instrumentation.ts).

const token = () => process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
const CONTACT_KEYBOARD = { reply_markup: { keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } };

/** Queue and send messages from a CRM action. Never throws: a Telegram problem must not fail the action. */
export async function notify(msgs: Outgoing[]) {
  const t = token();
  if (!t || !msgs.length) return;
  try {
    const store = prismaStore();
    await enqueue(store, msgs);
    await flush(store, telegramClient(t, 10_000));
  } catch (e) {
    console.error("telegram notify:", (e as Error).message);
  }
}

/** Everything due now (reminders, nudges, the admins' list), from the database. */
export async function dueNow(now: Date): Promise<Outgoing[]> {
  const day = centreDay(now);
  const [groups, closed, subs, marked, linked] = await Promise.all([
    db.group.findMany({
      where: { status: "ACTIVE" },
      include: { room: true, course: { select: { lessonMin: true } }, teachers: true, _count: { select: { students: { where: { leftAt: null } } } } },
    }),
    closedDaysOf(),
    db.lessonChange.findMany({ where: { kind: "SUBSTITUTE", date: day } }),
    db.attendance.groupBy({ by: ["groupId"], where: { date: day } }),
    db.user.findMany({ where: { active: true, telegramChatId: { not: null } }, include: { role: true } }),
  ]);
  return dueMessages(
    groups.map((g) => ({
      id: g.id, name: g.name, time: g.time, days: g.days, startDate: g.startDate, lessonMin: g.course.lessonMin, room: g.room?.name ?? null,
      teacherId: g.teacherId, assistantId: g.assistantId, teachers: g.teachers, students: g._count.students, passed: lessonsPassed(g, closed(g.id), day),
    })),
    {
      now, closed, subs, markedGroups: new Set(marked.map((m) => m.groupId)),
      linked: new Map(linked.map((u) => [u.id, { name: u.name, isAdmin: parsePermissions(u.role).has("staff.manage") }])),
    },
  );
}

async function tick(client: TelegramClient) {
  try {
    const store = prismaStore();
    await enqueue(store, await dueNow(new Date()));
    await flush(store, client);
  } catch (e) {
    console.error("telegram tick:", (e as Error).message);
  }
}

async function handle(client: TelegramClient, u: Update) {
  const m = u.message;
  if (!m || m.chat.type !== "private" || !m.from) return;
  const chatId = String(m.chat.id);
  const staff = await db.user.findMany({ select: { id: true, name: true, phone: true, active: true } });
  const reply = linkReply({ fromId: m.from.id, contact: m.contact ? { userId: m.contact.user_id, phone: m.contact.phone_number } : undefined }, staff);
  if (reply.userId) {
    await linkChat(reply.userId, chatId);
    const who = staff.find((s) => s.id === reply.userId)!;
    await db.auditLog.create({ data: { userId: who.id, action: "telegram.link", summary: `Telegram ulandi: ${who.name}` } });
    await client.sendMessage(chatId, reply.text, { reply_markup: { remove_keyboard: true } });
  } else {
    await client.sendMessage(chatId, reply.text, CONTACT_KEYBOARD);
  }
}

async function poll(client: TelegramClient) {
  let offset = 0;
  for (;;) {
    try {
      for (const u of await client.getUpdates(offset, 30)) {
        offset = u.update_id + 1;
        await handle(client, u).catch((e) => console.error("telegram update:", (e as Error).message));
      }
    } catch (e) {
      console.error("telegram poll:", (e as Error).message);
      // a wrong token (401) or a second copy of the bot (409) won't fix itself in seconds: wait longer, log less
      const status = e instanceof TelegramError ? e.status : 0;
      await new Promise((r) => setTimeout(r, status === 401 || status === 409 ? 60_000 : 5000));
    }
  }
}

/** Starts the bot once per server process; does nothing without a token. */
export function startBot() {
  const t = token();
  const g = globalThis as { __telegramBot?: boolean };
  if (!t || g.__telegramBot) return;
  g.__telegramBot = true;
  const client = telegramClient(t);
  void poll(client);
  void tick(client);
  setInterval(() => void tick(client), 60_000);
  console.log("Telegram bot ishga tushdi");
}
