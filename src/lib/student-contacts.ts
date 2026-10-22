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

/** `npm run db:parents`: the old single parent becomes "Otasi" where Otasi is still empty (safe to run again). */
export function planParents(rows: ParentRow[]) {
  return rows
    .filter((r) => !r.fatherName && !r.fatherPhone && (r.parentName || r.parentPhone))
    .map((r) => ({ id: r.id, fatherName: r.parentName, fatherPhone: r.parentPhone }));
}

/** "Otasi: …, Onasi: …" for lists and exports (missing ones left out). */
export function parentPhones(s: { fatherPhone: string | null; motherPhone: string | null }) {
  return [s.fatherPhone && `Otasi: ${s.fatherPhone}`, s.motherPhone && `Onasi: ${s.motherPhone}`].filter(Boolean).join(", ");
}
