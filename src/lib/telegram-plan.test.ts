import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cancelText, dueMessages, linkReply, restoreText, salaryText, substituteTexts, substituteUndoText, type PlanContext, type PlanGroup,
} from "./telegram-plan";

const u = (s: string) => new Date(`${s}T00:00:00Z`);
// centre time is UTC+5: 08:30 in the centre = 03:30 UTC
const at = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return new Date(Date.UTC(2026, 9, 15, h - 5, m)); };

const group: PlanGroup = {
  id: 6, name: "ROBO-3", time: "09:00", days: "EVEN", endTime: null, schedules: [], startDate: u("2026-05-03"), lessonMin: 90, room: "2-xona",
  teacherId: 10, assistantId: 7, teachers: [], students: 11, passed: 71,
};
const linked = new Map([
  [10, { name: "Jasur Toshmatov", isAdmin: false }],
  [7, { name: "Shoxrux Aliyev", isAdmin: false }],
  [8, { name: "Aziz Karimov", isAdmin: false }],
  [1, { name: "Direktor", isAdmin: true }],
]);
const ctx = (now: Date, over: Partial<PlanContext> = {}): PlanContext => ({ now, closed: () => [], subs: [], markedGroups: new Set(), linked, ...over });
const to = (msgs: { userId: number; key: string }[], prefix: string) => msgs.filter((m) => m.key.startsWith(prefix)).map((m) => m.userId).sort((a, b) => a - b);

test("reminder: 30 minutes before, to teacher and assistant, within a 10-minute window", () => {
  const msgs = dueMessages([group], ctx(at("08:30")));
  assert.deepEqual(to(msgs, "reminder:"), [7, 10]);
  const m = msgs.find((x) => x.userId === 10)!;
  assert.equal(m.key, "reminder:6:2026-10-15:10");
  assert.equal(m.text, "⏰ 30 daqiqadan keyin dars: ROBO-3, 09:00–10:30, 2-xona. Bugun 71-dars.");
  assert.deepEqual(to(dueMessages([group], ctx(at("08:39"))), "reminder:"), [7, 10]);
  assert.deepEqual(to(dueMessages([group], ctx(at("08:41"))), "reminder:"), []); // window passed (restart / outage)
  assert.deepEqual(to(dueMessages([group], ctx(at("08:29"))), "reminder:"), []);
});

test("reminder goes to who teaches that day: substitute, teacher history", () => {
  const sub = { groupId: 6, date: u("2026-10-15"), role: "TEACHER", substituteId: 8 };
  assert.deepEqual(to(dueMessages([group], ctx(at("08:30"), { subs: [sub] })), "reminder:"), [7, 8]);
  const history = { ...group, teachers: [{ userId: 8, role: "TEACHER", from: u("2026-10-01") }] };
  assert.deepEqual(to(dueMessages([history], ctx(at("08:30"))), "reminder:"), [7, 8]);
});

test("no reminder: cancelled, holiday, not started, no students, not linked", () => {
  assert.deepEqual(dueMessages([group], ctx(at("08:30"), { closed: () => ["2026-10-15"] })), []);
  assert.deepEqual(dueMessages([{ ...group, startDate: u("2026-10-20") }], ctx(at("08:30"))), []);
  assert.deepEqual(dueMessages([{ ...group, students: 0 }], ctx(at("08:30"))), []);
  assert.deepEqual(dueMessages([{ ...group, days: "ODD" }], ctx(at("08:30"))), []); // no lesson on Thursday
  assert.deepEqual(to(dueMessages([group], ctx(at("08:30"), { linked: new Map([[7, linked.get(7)!]]) })), "reminder:"), [7]);
});

test("not marked 15 minutes after start: teacher, assistant, and one list per admin", () => {
  const msgs = dueMessages([group, { ...group, id: 9, name: "KS-21", time: "09:00" }], ctx(at("09:15")));
  assert.deepEqual(to(msgs, "unmarked:6:"), [7, 10]);
  assert.equal(msgs.find((m) => m.key === "unmarked:6:2026-10-15:10")!.text, "📋 ROBO-3 (09:00) davomati hali belgilanmagan.");
  const admin = msgs.filter((m) => m.key.startsWith("admin-unmarked:"));
  assert.equal(admin.length, 1);
  assert.equal(admin[0].userId, 1);
  assert.equal(admin[0].key, "admin-unmarked:2026-10-15:09:00:1");
  assert.equal(admin[0].text, "📋 Davomat qilinmagan: ROBO-3 (09:00), KS-21 (09:00)");
  assert.deepEqual(dueMessages([group], ctx(at("09:15"), { markedGroups: new Set([6]) })), []);
});

test("change and salary texts", () => {
  assert.equal(cancelText("ROBO-3", u("2026-10-17"), "o'qituvchi kasal"), "❌ 17.10 ROBO-3 darsi bekor qilindi: o'qituvchi kasal");
  assert.equal(cancelText("ROBO-3", u("2026-10-17"), null), "❌ 17.10 ROBO-3 darsi bekor qilindi");
  assert.equal(restoreText("ROBO-3", u("2026-10-17")), "✅ 17.10 ROBO-3 darsi qayta tiklandi");
  assert.deepEqual(substituteTexts("ROBO-3", u("2026-10-17"), "09:00", "Jasur Toshmatov", "Aziz Karimov"), {
    toSubstitute: "🔁 17.10 09:00 ROBO-3 darsini siz o'tasiz (Aziz Karimov o'rniga)",
    toAbsent: "🔁 17.10 ROBO-3 darsingizni Jasur Toshmatov o'tadi",
  });
  assert.equal(substituteUndoText("ROBO-3", u("2026-10-17")), "↩️ 17.10 ROBO-3: o'rinbosar bekor qilindi");
  assert.match(salaryText("2026-10", 3_000_000), /^💰 Oktabr 2026 uchun ish haqi to'landi: 3.000.000 so'm$/);
});

test("linking: only your own contact, matched to active staff by digits", () => {
  const staff = [
    { id: 8, name: "Aziz Karimov", phone: "930000000", active: true },
    { id: 12, name: "Old", phone: "+998 91 111 11 11", active: false },
  ];
  assert.deepEqual(linkReply({ fromId: 55, contact: { userId: 55, phone: "+998930000000" } }, staff), {
    userId: 8, text: "✅ Ulandingiz, Aziz Karimov. Endi darslar haqida xabarlar shu yerga keladi.",
  });
  assert.deepEqual(linkReply({ fromId: 55, contact: { userId: 99, phone: "930000000" } }, staff), { userId: null, text: "Faqat o'zingizning raqamingizni yuboring." });
  assert.deepEqual(linkReply({ fromId: 55, contact: { userId: 55, phone: "911111111" } }, staff), { userId: null, text: "Bu raqam CRM'da topilmadi. Administratorga murojaat qiling." });
  assert.deepEqual(linkReply({ fromId: 55 }, staff), { userId: null, text: "Ulanish uchun pastdagi «📱 Raqamni yuborish» tugmasini bosing." });
});

test("admins get one list per lesson start time, even as teachers mark during the window", () => {
  const a = { ...group, id: 6, name: "ROBO-3", time: "09:00" };
  const b = { ...group, id: 9, name: "KS-21", time: "09:00" };
  const first = dueMessages([a, b], ctx(at("09:15"))).find((m) => m.key.startsWith("admin-unmarked:"))!;
  // ROBO-3 gets marked at 09:17: the admins' message for the 09:00 lessons keeps the same key, so it isn't sent again
  const later = dueMessages([a, b], ctx(at("09:17"), { markedGroups: new Set([6]) })).find((m) => m.key.startsWith("admin-unmarked:"))!;
  assert.equal(first.key, "admin-unmarked:2026-10-15:09:00:1");
  assert.equal(later.key, first.key);
  // a group starting at 09:05 gets its own list
  const c = { ...group, id: 11, name: "PY-07", time: "09:05" };
  const keys = dueMessages([a, c], ctx(at("09:20"))).filter((m) => m.key.startsWith("admin-unmarked:")).map((m) => m.key).sort();
  assert.deepEqual(keys, ["admin-unmarked:2026-10-15:09:00:1", "admin-unmarked:2026-10-15:09:05:1"]);
});

test("make-up texts: moved lesson for the group's people, an own line for a different make-up teacher", async () => {
  const { makeupTexts, makeupUndoText } = await import("./telegram-plan");
  const day = (m: number, x: number) => new Date(Date.UTC(2026, m - 1, x));
  assert.deepEqual(makeupTexts("FE-12", day(10, 23), day(10, 25), "14:00", "2-xona"), {
    regular: "FE-12: 23.10 dagi dars 25.10 14:00 ga ko'chirildi (2-xona)",
    cover: "Siz FE-12 guruhining 25.10 14:00 dagi qo'shimcha darsini o'tasiz (2-xona)",
  });
  assert.deepEqual(makeupTexts("FE-12", day(10, 23), day(10, 25), "14:00", null), {
    regular: "FE-12: 23.10 dagi dars 25.10 14:00 ga ko'chirildi",
    cover: "Siz FE-12 guruhining 25.10 14:00 dagi qo'shimcha darsini o'tasiz",
  });
  assert.equal(makeupUndoText("FE-12", day(10, 25)), "FE-12: 25.10 dagi qo'shimcha dars bekor qilindi");
});

test("a make-up lesson today gets its reminder and nudge, even off the group's usual days", () => {
  const odd = { ...group, days: "ODD" }; // 15 Oct 2026 is a Thursday: not an ODD day
  assert.deepEqual(to(dueMessages([odd], ctx(at("08:30"))), "reminder:"), []);
  assert.deepEqual(to(dueMessages([{ ...odd, makeupToday: true }], ctx(at("08:30"))), "reminder:"), [7, 10]);
  assert.deepEqual(to(dueMessages([{ ...odd, makeupToday: true }], ctx(at("09:15"))), "unmarked:"), [7, 10]);
});

test("reminders follow the schedule of the day: old days and time until a change, the new ones after", () => {
  const changed: PlanGroup = {
    ...group, days: "EVEN", time: "16:00", endTime: "17:30", lessonMin: 120,
    schedules: [{ from: u("2026-09-01"), days: "ODD", time: "14:00", endTime: null }, { from: u("2026-11-16"), days: "EVEN", time: "16:00", endTime: "17:30" }],
  };
  const on = (iso: string, hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return new Date(`${iso}T${String(h - 5).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`); };
  const before = dueMessages([changed], ctx(on("2026-11-09", "13:30"))).filter((m) => m.key.startsWith("reminder:"));
  assert.ok(before.length > 0 && before.every((m) => m.text.includes("14:00–16:00")));
  assert.deepEqual(dueMessages([changed], ctx(on("2026-11-23", "13:30"))), []);
  const after = dueMessages([changed], ctx(on("2026-11-17", "15:30"))).filter((m) => m.key.startsWith("reminder:"));
  assert.ok(after.length > 0 && after.every((m) => m.text.includes("16:00–17:30")));
});
