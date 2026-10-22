import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/access";
import { loadDebtors } from "@/lib/lists/debtors";
import { ExportButtons } from "@/components/ExportButtons";
import { money } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { PaymentForm } from "@/components/PaymentForm";
import { priceNow } from "@/lib/billing";
import { Empty, PageHeader, Segmented } from "@/components/ui";
import { parentPhones } from "@/lib/student-contacts";
import { DEBTOR_STATUSES } from "@/lib/debtor-status";

export default async function DebtorsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requirePage("debtors.view");
  const { debtors, total, status } = await loadDebtors(user, await searchParams);

  return (
    <>
      <PageHeader title="Qarzdorlar" subtitle={`${debtors.length} ta o'quvchi · jami qarz ${money(-total)}`}>
        <Segmented options={Object.entries(DEBTOR_STATUSES).map(([k, label]) => ({ href: `/debtors?status=${k}`, label, active: status === k }))} />
        <ExportButtons href="/debtors/export" />
      </PageHeader>
      <div className="card md:overflow-x-auto">
        <table className="table table-stack">
          <thead><tr><th>Ism</th><th>Telefon</th><th>Ota-ona</th><th>Guruhlar</th><th>Qarz</th><th></th></tr></thead>
          <tbody>
            {debtors.map((s) => {
              const active = s.groups.filter((g) => !g.leftAt).map((g) => g.group);
              return (
                <tr key={s.id}>
                  <td className="max-md:text-base"><Link href={`/students/${s.id}`} className="font-medium hover:underline">{s.name}</Link></td>
                  <td data-label="Telefon"><a href={`tel:${s.phone}`} className="font-mono hover:underline">{s.phone}</a></td>
                  <td data-label="Ota-ona" className="font-mono text-muted">{parentPhones(s) || "—"}</td>
                  <td data-label="Guruhlar">{active.map((g) => g.name).join(", ") || "—"}</td>
                  <td data-label="Qarz" className="font-semibold text-danger">{money(-s.balance)}</td>
                  <td>
                    {can(user, "payments.create") && <Modal title={`To'lov — ${s.name}`} triggerClassName="btn-secondary py-1 text-xs max-md:mt-2 max-md:w-full" trigger="To'lov qilish">
                      <PaymentForm studentId={s.id} groups={active.map((g) => ({ id: g.id, name: g.name, price: priceNow(g) }))} balance={s.balance} />
                    </Modal>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {debtors.length === 0 && <Empty text="Qarzdorlar yo'q 🎉" />}
      </div>
    </>
  );
}
