import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { respondTable } from "@/lib/export";
import { roomsTable } from "@/lib/lists/rooms";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!can(user, "rooms.manage")) return new Response("Ruxsat yo'q", { status: 403 });
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return respondTable(await roomsTable(user, params), params.format ?? null);
}
