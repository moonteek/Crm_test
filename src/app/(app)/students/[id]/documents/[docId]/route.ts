import { requireUser } from "@/lib/auth";
import { can, studentScope } from "@/lib/access";
import { db } from "@/lib/db";

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };

/** One student document: opened in the browser, or downloaded with `?download=1`. Same rights as the "Hujjatlar" tab. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const user = await requireUser();
  const { id, docId } = await params;
  if (!can(user, "students.manage")) return new Response("Topilmadi", { status: 404 });
  const doc = await db.studentDocument.findFirst({
    where: { id: Number(docId) || 0, studentId: Number(id) || 0, student: studentScope(user) },
  });
  if (!doc) return new Response("Topilmadi", { status: 404 });
  const download = new URL(req.url).searchParams.get("download") === "1";
  // the file name is ASCII-safe for the header; the full name goes in the RFC 5987 form
  const file = `${doc.name}.${EXT[doc.mime] ?? "bin"}`;
  const ascii = file.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return new Response(Buffer.from(doc.data, "base64"), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
