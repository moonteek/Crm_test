import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { respondTable } from "@/lib/export";
import { loadRisk } from "@/lib/lists/risk";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!can(user, "risk.view")) return new Response("Ruxsat yo'q", { status: 403 });
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return respondTable((await loadRisk(params)).table, params.format ?? null);
}
