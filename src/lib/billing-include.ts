import type { Prisma } from "@prisma/client";

// Prisma includes that load exactly what src/lib/billing.ts needs, so every balance is computed the same way.
export const membershipInclude = {
  events: { orderBy: [{ date: "asc" }, { id: "asc" }] },
  group: { include: { course: true } },
} satisfies Prisma.GroupStudentInclude;

export const studentBillingInclude = {
  groups: { include: membershipInclude },
  payments: { select: { amount: true } },
} satisfies Prisma.StudentInclude;
