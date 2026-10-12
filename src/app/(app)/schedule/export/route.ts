import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { respondTable } from "@/lib/export";
import { scheduleTable } from "@/lib/lists/schedule";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!can(user, "groups.view")) return new Response("Ruxsat yo'q", { status: 403 });
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return respondTable(await scheduleTable(user, params), params.format ?? null);
}
