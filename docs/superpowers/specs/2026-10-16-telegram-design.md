# Telegram messages — design

## Goal

Staff get short Telegram messages from the centre's bot: a reminder before each lesson, a nudge when attendance isn't
marked, news about cancelled lessons and substitutes, and a note when their salary is paid. Linking is one tap in the
bot — nobody types chat IDs.

## User's answers (binding)

- The CRM runs on a rented server (VPS), always on.
- Linking: the person presses **Start** in the bot and shares their phone number; a match with an active staff member
  links their chat.
- Timing: reminder **30 minutes before** a lesson; "attendance not marked" **15 minutes after** it starts.
- Recipients: the teacher, **assistant teachers too**, and **Administrators get the "attendance not marked" list**.
- Message kinds (from the teacher-form step): lesson reminder, attendance not marked, lesson changes, salary paid.

## How it runs

- Approach A: the bot lives inside the CRM's server process. `src/instrumentation.ts` (`register()`, Node runtime
  only) starts it once when `TELEGRAM_BOT_TOKEN` is set; without the token nothing starts (this computer, tests).
- One loop **long-polls** Telegram (`getUpdates`, no https/webhook needed) for Start presses and shared contacts.
- A **minute timer** checks reminders and unmarked attendance, and retries failed messages.
- Telegram is called through a tiny client (`sendMessage`, `getUpdates`, `getMe`) with `fetch`; no bot library.
- The token is a secret: only in `.env` (`TELEGRAM_BOT_TOKEN`), never in the database, page or logs.
- Only one server process may run the bot (Telegram allows one `getUpdates` reader per token). README says: one
  instance, and use a separate test bot for development.

## Data

- `User.telegramChatId` (exists) holds the linked chat. Linking sets it; "Uzish" (unlink) clears it.
- New `TelegramMessage { id, key String @unique, userId, chatId, text, status (PENDING | SENT | FAILED), tries,
  error?, createdAt, sentAt? }`.
  - `key` makes every message happen once, e.g. `reminder:<groupId>:<yyyy-mm-dd>:<userId>`,
    `unmarked:<groupId>:<day>:<userId>`, `admin-unmarked:<day>:<HH:MM>:<userId>`, `cancel:<changeId>:<userId>`,
    `restore:<groupId>:<day>:<n>:<userId>`, `sub:<changeId>:<userId>`, `salary:<payoutId>`.
  - Sending = insert (PENDING) then send; a duplicate key is skipped. Failures retry on the minute timer up to 3 tries,
    then FAILED.

## Linking

- `/start` → the bot answers with a "📱 Raqamni yuborish" button (request_contact).
- On a shared contact: only the sender's **own** contact counts (`contact.user_id === from.id`). The phone is matched by
  digits (`phoneKey`) against **active** staff.
  - Match → save the chat id: "✅ Ulandingiz, Aziz Karimov. Endi darslar haqida xabarlar shu yerga keladi."
  - No match → "Bu raqam CRM'da topilmadi. Administratorga murojaat qiling."
  - A chat already linked to someone else moves to the new person (one chat per person).
- Blocked staff get no messages; unlinking happens on the teacher card or in Sozlamalar → Telegram.

## Messages (Uzbek; times in centre time)

| Kind | When | To | Text (example) |
| --- | --- | --- | --- |
| Reminder | 30 min before start | who teaches it that day (teacher/assistant after substitutes) | "⏰ 30 daqiqadan keyin dars: ROBO-3, 09:00–10:30, 2-xona. Bugun 71-dars." |
| Not marked | 15 min after start, no marks | teacher + assistant on that lesson | "📋 ROBO-3 (09:00) davomati hali belgilanmagan." |
| Not marked (admins) | same check, one list per run | linked Administrators (`staff.manage`) | "📋 Davomat qilinmagan: ROBO-3 (09:00), PY-07 (16:00)" |
| Cancelled | on cancel | teacher + assistant of that day | "❌ 17.10 ROBO-3 darsi bekor qilindi: o'qituvchi kasal" |
| Restored | on undo | same | "✅ 17.10 ROBO-3 darsi qayta tiklandi" |
| Substitute | on substitute | the substitute; the replaced person | "🔁 17.10 09:00 ROBO-3 darsini siz o'tasiz (Aziz Karimov o'rniga)" / "🔁 17.10 ROBO-3 darsingizni Jasur Toshmatov o'tadi" |
| Substitute undone | on undo | both | "↩️ 17.10 ROBO-3: o'rinbosar bekor qilindi" |
| Salary paid | on payout | that person | "💰 Oktabr 2026 uchun ish haqi to'landi: 3 000 000 so'm" |

- No reminder or nudge for cancelled lessons, holidays, groups not yet started, or groups without active students.
- Lessons in the past when the server (re)starts don't get late reminders: only lessons whose send time falls in the
  last 10 minutes.
- Messages carry no student data and no money except the person's own salary.

## Settings — Sozlamalar → Telegram (`staff.manage`)

- Status: bot on/off (token present, `getMe` works) with the bot's @name and a t.me link; "Token yo'q" with a short
  how-to when off.
- Linked staff (name, role, unlink button) and active staff not linked yet.
- Last 50 messages with status (Yuborildi / Kutilmoqda / Xato + reason).
- "Sinov xabari": sends "Sinov xabari ✅" to the admin's own linked chat.
- Teacher cards: "Telegram ✓" when linked; the form's chat ID field becomes read-only text ("Ulangan" / "Ulanmagan —
  botda Start bosing").

## Safety

- A Telegram failure never fails a CRM action: the action saves, the message is queued, sending happens after.
- The bot only reads Start, contacts and plain text ("Salom" → the link instructions); it never changes CRM data except
  the chat link.

## Testing

- Unit (pure `src/lib/telegram-plan.ts`): which reminders/nudges are due for a time (30/15 min windows, 10-minute
  catch-up limit, cancelled, holiday, substitute takes over, assistant included, not started, no students, already
  sent keys); admin list; texts; contact linking rules (own contact only, phone match, inactive staff).
- Integration: the sender with a fake Telegram client (queued → sent, failure → retry → FAILED, duplicate key skipped).
- Browser: Sozlamalar → Telegram without a token (off state), linked/unlinked lists, teacher card mark.
- Real check with the user's bot once the token is on the server (step in README).

## Not included

Messages to students or parents, choosing message kinds per person, editable message texts, group chats.
