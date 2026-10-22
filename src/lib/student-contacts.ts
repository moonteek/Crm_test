import { z } from "zod";

// The student's extra contacts: father and mother (name + phone), Telegram username and email.

const blank = (x: unknown) => (typeof x === "string" ? x.trim() : x) || null;

/** "@aziz_k" or "aziz_k" → "aziz_k"; blank → null. */
export const telegramField = z.preprocess(
  blank,
  z.string().regex(/^@?[A-Za-z0-9_]{5,32}$/, "Telegram username noto'g'ri").transform((s) => s.replace(/^@/, "")).nullable(),
);

/** A simple name@site.uz shape; blank → null. */
export const emailField = z.preprocess(
  blank,
  z.string().max(120, "Email noto'g'ri").regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email noto'g'ri").nullable(),
);

type ParentRow = { id: number; parentName: string | null; parentPhone: string | null; fatherName: string | null; fatherPhone: string | null };

/**
 * `npm run db:parents`: the old single parent becomes "Otasi" where Otasi is still empty, and the old field is emptied
 * either way — so running it again never brings back an "Otasi" that staff have since corrected or cleared.
 */
export function planParents(rows: ParentRow[]) {
  return rows
    .filter((r) => r.parentName || r.parentPhone)
    .map((r) => {
      const copy = !r.fatherName && !r.fatherPhone;
      return { id: r.id, fatherName: copy ? r.parentName : r.fatherName, fatherPhone: copy ? r.parentPhone : r.fatherPhone, parentName: null, parentPhone: null };
    });
}

/** "Otasi: …, Onasi: …" for lists and exports (missing ones left out). */
export function parentPhones(s: { fatherPhone: string | null; motherPhone: string | null }) {
  return [s.fatherPhone && `Otasi: ${s.fatherPhone}`, s.motherPhone && `Onasi: ${s.motherPhone}`].filter(Boolean).join(", ");
}
