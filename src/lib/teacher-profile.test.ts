import { test } from "node:test";
import assert from "node:assert/strict";
import { ageText, teacherFormSchema } from "./teacher-profile";
import { imageProblem } from "./image";

const base = { name: "Aziza Karimova", phone: "90 123 45 67", roleId: "2", gender: "F", password: "secret12", salaryType: "PERCENT", salaryAmount: "30" };
const errors = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? "" : r.error!.issues.map((i) => i.message).join("; "));

test("adding a teacher: name, phone, password and gender are required", () => {
  assert.ok(teacherFormSchema("create").safeParse(base).success);
  assert.match(errors(teacherFormSchema("create").safeParse({ ...base, gender: "" })), /Jinsini tanlang/);
  assert.equal(teacherFormSchema("create").safeParse({ ...base, password: "" }).success, false);
});

test("editing: an empty password keeps the old one; gender may stay unset for older staff", () => {
  const r = teacherFormSchema("edit").safeParse({ ...base, password: "", gender: "" });
  assert.ok(r.success, errors(r));
  assert.equal(r.data!.password, undefined);
  assert.equal(r.data!.gender, null);
});

test("Telegram chat ID: digits only, a group chat may start with a minus; empty is fine", () => {
  const p = (telegramChatId: string) => teacherFormSchema("create").safeParse({ ...base, telegramChatId });
  assert.equal(p("123456789").data?.telegramChatId, "123456789");
  assert.equal(p("-1001234567890").data?.telegramChatId, "-1001234567890");
  assert.equal(p("").data?.telegramChatId, null);
  assert.match(errors(p("@aziza")), /Telegram chat ID/);
  assert.match(errors(p("12ab")), /Telegram chat ID/);
});

test("salary on the form follows the Ish haqi rules", () => {
  assert.match(errors(teacherFormSchema("create").safeParse({ ...base, salaryAmount: "150" })), /Foiz 0–100/);
  assert.equal(teacherFormSchema("create").safeParse({ ...base, salaryType: "NONE", salaryAmount: "" }).data?.salaryAmount, 0);
});

test("birth date: optional, never in the future", () => {
  assert.equal(teacherFormSchema("create").safeParse({ ...base, birthDate: "" }).data?.birthDate, null);
  assert.match(errors(teacherFormSchema("create").safeParse({ ...base, birthDate: "2999-01-01" })), /kelajakda/);
});

test("age in full years", () => {
  assert.equal(ageText(new Date("1997-05-20T00:00:00Z"), new Date("2026-10-15T00:00:00Z")), "29 yosh");
  assert.equal(ageText(new Date("1997-12-01T00:00:00Z"), new Date("2026-10-15T00:00:00Z")), "28 yosh");
});

test("photo: PNG or JPG up to 300 KB, named in the message", () => {
  assert.equal(imageProblem("data:image/png;base64,iVBORw0KGgo=", "Rasm"), null);
  assert.equal(imageProblem("data:image/gif;base64,R0lGOD", "Rasm"), "Faqat PNG yoki JPG");
  const big = "data:image/jpeg;base64," + "A".repeat(Math.ceil((301 * 1024 * 4) / 3));
  assert.equal(imageProblem(big, "Rasm"), "Rasm 300 KB dan katta");
});
