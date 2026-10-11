import { requireUser } from "@/lib/auth";
import { can, canSeeBalances } from "@/lib/access";
import { respondTable } from "@/lib/export";
import { loadStudents } from "@/lib/lists/students";
import { parseStudentFilters } from "@/lib/student-filters";

/** The student list as Excel (or tab-separated text for Google Sheets), with the page's filters. */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!can(user, "students.view")) return new Response("Ruxsat yo'q", { status: 403 });
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const { table } = await loadStudents(user, parseStudentFilters(params, { canSeeBalances: canSeeBalances(user) }));
  return respondTable(table, params.format ?? null);
}
