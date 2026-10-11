import type { Prisma } from "@prisma/client";

// The student list's filters, read from the URL: shared by the page and its Excel / Google Sheets export,
// so the file always holds exactly what the page shows.

export const STUDENT_STATUSES = {
  active: "Faol",
  trial: "Sinovda",
  frozen: "Muzlatilgan",
  none: "Guruhsiz / chiqib ketgan",
  debtor: "Qarzdor",
  all: "Barchasi",
} as const;
export type StudentStatus = keyof typeof STUDENT_STATUSES;
export const PAGE_SIZES = [20, 50, 100] as const;

export type StudentFilters = {
  q: string;
  groupId: number | null;
  courseId: number | null;
  teacherId: number | null;
  tagId: number | null;
  status: StudentStatus;
  page: number;
  per: (typeof PAGE_SIZES)[number];
};

const id = (x: string | undefined) => {
  const n = Number(x);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function parseStudentFilters(p: Record<string, string | undefined>, opts: { canSeeBalances: boolean }): StudentFilters {
  let status: StudentStatus = p.status && p.status in STUDENT_STATUSES ? (p.status as StudentStatus) : "active";
  // a role that can't see balances can't list debtors either
  if (status === "debtor" && !opts.canSeeBalances) status = "all";
  const per = PAGE_SIZES.find((n) => n === Number(p.per)) ?? 20;
  return {
    q: (p.q ?? "").trim(),
    groupId: id(p.group),
    courseId: id(p.course),
    teacherId: id(p.teacher),
    tagId: id(p.tag),
    status,
    page: id(p.page) ?? 1,
    per,
  };
}

const MEMBERSHIP_STATUS: Partial<Record<StudentStatus, string>> = { active: "ACTIVE", trial: "TRIAL", frozen: "FROZEN" };

/** The database part of the filters ("Qarzdor" needs balances and is applied after loading). */
export function studentWhere(f: StudentFilters, scope: Prisma.StudentWhereInput): Prisma.StudentWhereInput {
  const and: Prisma.StudentWhereInput[] = [scope];
  if (f.q) and.push({ OR: [{ name: { contains: f.q } }, { phone: { contains: f.q } }, { phone2: { contains: f.q } }, { parentPhone: { contains: f.q } }] });
  if (f.groupId) and.push({ groups: { some: { leftAt: null, groupId: f.groupId } } });
  if (f.courseId) and.push({ groups: { some: { leftAt: null, group: { courseId: f.courseId } } } });
  if (f.teacherId) and.push({ groups: { some: { leftAt: null, group: { OR: [{ teacherId: f.teacherId }, { assistantId: f.teacherId }] } } } });
  if (f.tagId) and.push({ tags: { some: { tagId: f.tagId } } });
  const membership = MEMBERSHIP_STATUS[f.status];
  if (membership) and.push({ groups: { some: { status: membership } } });
  if (f.status === "none") and.push({ groups: { none: { leftAt: null } } });
  return { AND: and };
}
