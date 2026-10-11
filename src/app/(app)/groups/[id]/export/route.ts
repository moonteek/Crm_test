import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { respondTable } from "@/lib/export";
import { groupSheet } from "@/lib/lists/group-sheet";

/** The group page's Davomat / Baholar / Imtihonlar tab as Excel or Sheets text. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "groups.view")) return new Response("Ruxsat yo'q", { status: 403 });
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const table = await groupSheet(user, Number((await params).id), q);
  if (!table) return new Response("Guruh topilmadi", { status: 404 });
  return respondTable(table, q.format ?? null);
}
