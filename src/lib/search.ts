import type { Prisma } from "@prisma/client";

/** A student matches by name, own phones, or either parent's phone or name. */
export const contactMatch = (q: string) => [
  { name: { contains: q } }, { phone: { contains: q } }, { phone2: { contains: q } },
  { fatherPhone: { contains: q } }, { motherPhone: { contains: q } }, { fatherName: { contains: q } }, { motherName: { contains: q } },
];

/** Students matching the top-bar search: name, any phone or a parent. Null under two characters (too many matches). */
export function searchWhere(raw: string): Prisma.StudentWhereInput | null {
  const q = raw.trim();
  if (q.length < 2) return null;
  return { OR: contactMatch(q) };
}
