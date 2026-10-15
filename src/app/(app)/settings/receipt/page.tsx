import { requirePage } from "@/lib/auth";
import { getReceiptSettings } from "@/lib/receipt-db";
import { ReceiptSettingsForm } from "@/components/receipt/ReceiptSettingsForm";

export default async function ReceiptSettingsPage() {
  await requirePage("staff.manage");
  return <ReceiptSettingsForm saved={await getReceiptSettings()} />;
}
