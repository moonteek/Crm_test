import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { OPEN_STATUSES, pickAssignee } from "@/lib/sales";

export const dynamic = "force-dynamic";

const digits = (s: string) => s.replace(/\D/g, "");

function keyMatches(given: string | null) {
  const expected = process.env.LEADS_WEBHOOK_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Receives leads from Instagram / Telegram automations (ManyChat, a Telegram bot,
 * a website form, Make/Zapier). JSON or form fields: name, phone, source, course, note.
 * Auth: header `X-Api-Key: <LEADS_WEBHOOK_KEY>` or `?key=`.
 */
export async function POST(req: Request) {
  if (!process.env.LEADS_WEBHOOK_KEY) return Response.json({ error: "LEADS_WEBHOOK_KEY sozlanmagan" }, { status: 503 });
  const url = new URL(req.url);
  if (!keyMatches(req.headers.get("x-api-key") ?? url.searchParams.get("key"))) {
    return Response.json({ error: "Kalit noto'g'ri" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  const type = req.headers.get("content-type") ?? "";
  try {
    body = type.includes("application/json") ? await req.json() : Object.fromEntries((await req.formData()).entries());
  } catch {
    return Response.json({ error: "Ma'lumotni o'qib bo'lmadi" }, { status: 400 });
  }
  const field = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const name = field("name").slice(0, 120) || "Ismsiz lid";
  const phone = field("phone").slice(0, 40);
  if (digits(phone).length < 7) return Response.json({ error: "Telefon raqam kerak" }, { status: 422 });
  const source = field("source").slice(0, 40) || "Boshqa";
  const note = field("note").slice(0, 1000) || null;

  const courseName = field("course");
  const course = courseName ? (await db.course.findMany()).find((c) => c.name.toLowerCase().includes(courseName.toLowerCase())) : undefined;

  // Same person writing again: add a note to their open lead instead of creating a duplicate.
  const tail = digits(phone).slice(-9);
  const existing = (await db.lead.findMany({ where: { status: { in: OPEN_STATUSES } }, select: { id: true, phone: true } }))
    .find((l) => digits(l.phone).slice(-9) === tail);
  if (existing) {
    await db.leadActivity.create({ data: { leadId: existing.id, type: "MESSAGE", text: `${source} orqali qayta yozdi${note ? `: ${note}` : ""}` } });
    await db.lead.update({ where: { id: existing.id }, data: { nextActionAt: new Date() } });
    return Response.json({ ok: true, lead_id: existing.id, duplicate: true });
  }

  const lead = await db.lead.create({
    data: { name, phone, source, note, courseId: course?.id, assignedToId: await pickAssignee(), nextActionAt: new Date() },
    include: { assignedTo: true },
  });
  await logAction(null, "lead.create", `Yangi lid (${source}, avtomatik): ${name} → ${lead.assignedTo?.name ?? "biriktirilmagan"}`);
  return Response.json({ ok: true, lead_id: lead.id, assigned_to: lead.assignedTo?.name ?? null }, { status: 201 });
}
