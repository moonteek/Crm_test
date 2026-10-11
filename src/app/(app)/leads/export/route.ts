import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { respondTable } from "@/lib/export";
import { leadsTable } from "@/lib/lists/leads";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!can(user, "leads.view")) return new Response("Ruxsat yo'q", { status: 403 });
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return respondTable(await leadsTable(user, params), params.format ?? null);
}
