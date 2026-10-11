import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { respondTable } from "@/lib/export";
import { teachersTable } from "@/lib/lists/teachers";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!can(user, "teachers.view")) return new Response("Ruxsat yo'q", { status: 403 });
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return respondTable(await teachersTable(user, params), params.format ?? null);
}
