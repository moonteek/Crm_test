import type { Prisma } from "@prisma/client";

/** Students matching the top-bar search: name or any phone. Null under two characters (too many matches). */
export function searchWhere(raw: string): Prisma.StudentWhereInput | null {
  const q = raw.trim();
  if (q.length < 2) return null;
  return { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { phone2: { contains: q } }, { parentPhone: { contains: q } }] };
}
