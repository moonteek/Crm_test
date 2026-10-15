import { z } from "zod";
import { v } from "./validation";
import { phoneKey } from "./phone";
import { SALARY_TYPES } from "./salary-types";

// The teacher form (O'qituvchilar → add / ✏️ edit): who they are, salary rule, photo, Telegram chat for later messages.

export const STAFF_GENDERS: Record<string, string> = { M: "Erkak", F: "Ayol" };

/** Digits only; a group chat's id starts with "-" (e.g. -1001234567890). */
const TELEGRAM_ID = /^-?\d{5,20}$/;

/** The form's fields. Adding needs a password and gender; editing keeps the password when left empty. */
export function teacherFormSchema(mode: "create" | "edit") {
  return z
    .object({
      name: v.text("Ism familiya", 120),
      phone: v.text("Telefon", 40).refine((p) => phoneKey(p).length >= 9, "Telefon raqam noto'g'ri (9 ta raqam kerak, masalan 901234567)"),
      roleId: v.id("Rol"),
      password: mode === "create" ? v.password() : v.optPassword(),
      gender: mode === "create"
        ? z.preprocess((x) => x || undefined, z.enum(["M", "F"], { error: "Jinsini tanlang" }))
        : z.preprocess((x) => x || null, z.enum(["M", "F"]).nullable()),
      birthDate: v.optDate().refine((d) => d === null || d.getTime() <= Date.now(), "Tug'ilgan sana kelajakda bo'lishi mumkin emas"),
      telegramChatId: v.optText(30).refine((t) => t === null || TELEGRAM_ID.test(t), "Telegram chat ID faqat raqamlardan iborat (guruh uchun boshida \"-\")"),
      note: v.optText(1000),
      salaryType: v.oneOf(SALARY_TYPES, "NONE"),
      salaryAmount: v.int("Ish haqi", { fallback: 0 }),
    })
    .refine((d) => d.salaryType !== "PERCENT" || d.salaryAmount <= 100, "Foiz 0–100 oralig'ida bo'lishi kerak");
}

/** "29 yosh": full years on `today`. */
export function ageText(birth: Date, today: Date) {
  let years = today.getUTCFullYear() - birth.getUTCFullYear();
  const before = today.getUTCMonth() < birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
  if (before) years--;
  return `${years} yosh`;
}
