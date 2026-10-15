import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getReceiptSettings, receiptDataFor } from "@/lib/receipt-db";
import { DEFAULT_LOGO, receiptLayout, receiptText } from "@/lib/receipt";
import { ReceiptView } from "@/components/receipt/ReceiptView";
import { PrintButtons } from "@/components/receipt/PrintButtons";

export const metadata = { title: "Chek" };

/** A payment's receipt on roll paper; `?print=1` (right after taking the payment) opens the print window. */
export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await receiptDataFor(user, Number(id));
  if (!data) notFound();
  const settings = await getReceiptSettings();
  // the page is exactly as long as the receipt (same layout as the view), so the roll isn't fed blank paper
  const heightMm = Math.ceil(receiptLayout(settings, receiptText(settings, data)).heightMm);
  return (
    <>
      <style>{`@page { size: ${settings.paper}mm ${heightMm}mm; margin: 0; } @media print { html, body { background: white; } }`}</style>
      <PrintButtons pdfHref={`/payments/${data.id}/receipt/pdf`} autoPrint={(await searchParams).print === "1"} />
      <ReceiptView settings={settings} data={data} logoSrc={settings.showLogo ? (settings.logo ?? DEFAULT_LOGO) : null} />
    </>
  );
}
