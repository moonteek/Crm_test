import { CircleStop, Trash2 } from "lucide-react";
import { date, money, MONTHS } from "@/lib/format";
import { canDelete, canEnd, discountState } from "@/lib/discounts";
import { deleteDiscount, endDiscount } from "@/app/(app)/actions";
import { Empty } from "@/components/ui";
import { ActionButton } from "@/components/ActionForm";

type Row = { id: number; amount: number; from: Date; to: Date; reason: string | null; createdAt: Date; user: { name: string } | null; group: string };
const month = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const STATE_CLS = { kutilmoqda: "bg-ink/5 text-muted", amalda: "bg-success-tint text-success", tugagan: "bg-ink/5 text-faint" } as const;

/** The student's discounts, newest first; staff with "Chegirma berish" may delete future ones or end running ones. */
export function DiscountList({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const today = new Date();
  if (!rows.length) return <Empty text="Chegirmalar yo'q" />;
  return (
    <div className="md:overflow-x-auto">
      <table className="table table-stack">
        <thead><tr><th>Guruh</th><th>Chegirma</th><th>Oylar</th><th>Sabab</th><th>Holati</th><th>Kim</th>{canManage && <th></th>}</tr></thead>
        <tbody>
          {rows.map((d) => {
            const state = discountState(d, today);
            return (
              <tr key={d.id}>
                <td className="font-medium max-md:order-first">{d.group}</td>
                <td data-label="Chegirma" className="font-semibold">−{money(d.amount)} / oy</td>
                <td data-label="Oylar">{d.from.getTime() === d.to.getTime() ? month(d.from) : `${month(d.from)} – ${month(d.to)}`}</td>
                <td data-label="Sabab" className="whitespace-normal text-muted">{d.reason ?? "—"}</td>
                <td data-label="Holati"><span className={`badge ${STATE_CLS[state]}`}>{state}</span></td>
                <td data-label="Kim" className="text-muted">{d.user?.name ?? "—"} · {date(d.createdAt)}</td>
                {canManage && (
                  <td>
                    {canDelete(d, today) && (
                      <ActionButton action={deleteDiscount.bind(null, d.id)} className="btn-ghost px-2 hover:text-danger" label="O'chirish" title="O'chirish"><Trash2 className="h-4 w-4" /></ActionButton>
                    )}
                    {canEnd(d, today) && (
                      <ActionButton action={endDiscount.bind(null, d.id)} className="btn-ghost px-2 text-xs" title="Shu oydan boshlab to'xtatish"><CircleStop className="h-4 w-4" /> Tugatish</ActionButton>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
