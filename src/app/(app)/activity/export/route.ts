import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { respondTable } from "@/lib/export";
import { activityTable } from "@/lib/lists/activity";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!can(user, "audit.view")) return new Response("Ruxsat yo'q", { status: 403 });
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return respondTable(await activityTable(user, params), params.format ?? null);
}
