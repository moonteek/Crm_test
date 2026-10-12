import { requireUser } from "@/lib/auth";
import { can, canSeeBalances, studentScope } from "@/lib/access";
import { db } from "@/lib/db";
import { balance, withHolidays } from "@/lib/billing";
import { membershipInclude } from "@/lib/billing-include";
import { holidayDays } from "@/lib/holidays-db";
import { searchWhere } from "@/lib/search";

/** Top-bar student search: up to 8 matches within the user's students; balances only for staff who see them. */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!can(user, "students.view")) return Response.json([], { status: 403 });
  const where = searchWhere(new URL(req.url).searchParams.get("q") ?? "");
  if (!where) return Response.json([]);
  const money = canSeeBalances(user);
  const students = await db.student.findMany({
    where: { AND: [where, studentScope(user)] },
    include: { payments: { select: { amount: true } }, groups: { include: membershipInclude } },
    orderBy: { name: "asc" },
    take: 8,
  });
  const holidays = money ? await holidayDays() : [];
  return Response.json(students.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    groups: s.groups.filter((g) => !g.leftAt).map((g) => g.group.name),
    balance: money ? balance(withHolidays(s.groups, holidays), s.payments) : null,
  })));
}
