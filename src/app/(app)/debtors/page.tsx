import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can, studentScope } from "@/lib/access";
import { balance } from "@/lib/billing";
import { money } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { PaymentForm } from "@/components/forms";
import { Empty, PageHeader } from "@/components/ui";

export default async function DebtorsPage() {
  const user = await requirePage("debtors.view");
  const students = await db.student.findMany({
    where: studentScope(user),
    include: {
      payments: { select: { amount: true } },
      groups: { include: { group: { include: { course: true } } } },
    },
  });
  const debtors = students
    .map((s) => ({ ...s, balance: balance(s.groups, s.payments) }))
    .filter((s) => s.balance < 0)
    .sort((a, b) => a.balance - b.balance);
  const total = debtors.reduce((sum, s) => sum + s.balance, 0);

  return (
    <>
      <PageHeader title="Qarzdorlar" subtitle={`${debtors.length} ta o'quvchi · jami qarz ${money(-total)}`} />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Ism</th><th>Telefon</th><th>Ota-ona</th><th>Guruhlar</th><th>Qarz</th><th></th></tr></thead>
          <tbody>
            {debtors.map((s) => {
              const active = s.groups.filter((g) => !g.leftAt).map((g) => g.group);
              return (
                <tr key={s.id}>
                  <td><Link href={`/students/${s.id}`} className="font-medium hover:text-brand-600">{s.name}</Link></td>
                  <td><a href={`tel:${s.phone}`} className="hover:text-brand-600">{s.phone}</a></td>
                  <td>{s.parentPhone ?? "—"}</td>
                  <td>{active.map((g) => g.name).join(", ") || "—"}</td>
                  <td className="font-semibold text-rose-600">{money(-s.balance)}</td>
                  <td>
                    {can(user, "payments.create") && <Modal title={`To'lov — ${s.name}`} triggerClassName="text-sm text-brand-600 hover:underline" trigger="To'lov qilish">
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
