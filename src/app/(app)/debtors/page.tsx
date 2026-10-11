import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/access";
import { loadDebtors } from "@/lib/lists/debtors";
import { ExportButtons } from "@/components/ExportButtons";
import { money } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { PaymentForm } from "@/components/forms";
import { Empty, PageHeader } from "@/components/ui";

export default async function DebtorsPage() {
  const user = await requirePage("debtors.view");
  const { debtors, total } = await loadDebtors(user);

  return (
    <>
      <PageHeader title="Qarzdorlar" subtitle={`${debtors.length} ta o'quvchi · jami qarz ${money(-total)}`}>
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
                  <td data-label="Ota-ona" className="font-mono text-muted">{s.parentPhone ?? "—"}</td>
                  <td data-label="Guruhlar">{active.map((g) => g.name).join(", ") || "—"}</td>
                  <td data-label="Qarz" className="font-semibold text-danger">{money(-s.balance)}</td>
                  <td>
                    {can(user, "payments.create") && <Modal title={`To'lov — ${s.name}`} triggerClassName="btn-secondary py-1 text-xs max-md:mt-2 max-md:w-full" trigger="To'lov qilish">
                      <PaymentForm studentId={s.id} groups={active} />
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
