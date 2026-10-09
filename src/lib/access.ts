import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { parsePermissions, type Permission } from "./permissions";

export type CurrentUser = {
  id: number;
  name: string;
  phone: string;
  roleName: string;
  isAdmin: boolean;
  isTeacher: boolean;
  permissions: Set<string>;
};

export class ForbiddenError extends Error {
  constructor() {
    super("Bu amal uchun ruxsat yo'q");
  }
}

/** Loads an active user with their role's permissions, or null. */
export async function loadUser(userId: number): Promise<CurrentUser | null> {
  const user = await db.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    roleName: user.role.name,
    isAdmin: user.role.isSystem,
    isTeacher: user.isTeacher,
    permissions: parsePermissions(user.role),
  };
}

export function can(user: CurrentUser, perm: Permission) {
  return user.permissions.has(perm);
}

/** Balances and debts are financial data: shown only to roles that see payments or debtors. */
export function canSeeBalances(user: CurrentUser) {
  return can(user, "payments.view") || can(user, "debtors.view");
}

export function assertCan(user: CurrentUser, ...perms: Permission[]) {
  if (!perms.every((p) => user.permissions.has(p))) throw new ForbiddenError();
}

/** Groups the user may see: all of them, or only the ones they teach or assist in. */
export function groupScope(user: CurrentUser): Prisma.GroupWhereInput {
  return can(user, "groups.all") ? {} : { OR: [{ teacherId: user.id }, { assistantId: user.id }] };
}

/** Students the user may see: all, or only those in groups they teach. */
export function studentScope(user: CurrentUser): Prisma.StudentWhereInput {
  return can(user, "groups.all") ? {} : { groups: { some: { leftAt: null, group: { OR: [{ teacherId: user.id }, { assistantId: user.id }] } } } };
}

export async function assertGroupAccess(user: CurrentUser, groupId: number) {
  const ok = await db.group.count({ where: { id: groupId, ...groupScope(user) } });
  if (!ok) throw new ForbiddenError();
}

export async function assertStudentAccess(user: CurrentUser, studentId: number) {
  const ok = await db.student.count({ where: { id: studentId, ...studentScope(user) } });
  if (!ok) throw new ForbiddenError();
}

const PAGE_ORDER: [string, Permission][] = [
  ["/", "dashboard.view"], ["/groups", "groups.view"], ["/students", "students.view"], ["/leads", "leads.view"],
  ["/payments", "payments.view"], ["/debtors", "debtors.view"], ["/finance", "finance.view"], ["/settings/mcp", "mcp.use"],
];

/** Where to send a user after login when they can't see the dashboard. */
export function firstAllowedPage(user: CurrentUser) {
  return PAGE_ORDER.find(([, p]) => can(user, p))?.[0] ?? "/no-access";
}
