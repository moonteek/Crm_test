import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getUser } from "@/lib/auth";
import { getReceiptSettings, receiptDataFor } from "@/lib/receipt-db";
import { receiptPdf } from "@/lib/receipt-pdf";

/** The receipt as a PDF file (chek-<id>.pdf); 404 when the payment is missing or not the user's to see. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const data = user ? await receiptDataFor(user, Number((await params).id)) : null;
  if (!data) return new Response("Chek topilmadi", { status: 404 });
  const settings = await getReceiptSettings();
  let logo: Uint8Array | null = null;
  if (settings.showLogo) {
    logo = settings.logo
      ? Buffer.from(settings.logo.slice(settings.logo.indexOf(",") + 1), "base64")
      : await readFile(join(process.cwd(), "public", "receipt-logo.png"));
  }
  const pdf = await receiptPdf(settings, data, logo);
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="chek-${data.id}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
