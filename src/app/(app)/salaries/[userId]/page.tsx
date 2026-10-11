import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { date, money, MONTHS } from "@/lib/format";
import { currentMonth, salaryBreakdown, SALARY_TYPES } from "@/lib/salary";
import { Empty, PageHeader } from "@/components/ui";

export default async function SalaryDetailPage({
  params, searchParams,
}: { params: Promise<{ userId: string }>; searchParams: Promise<{ m?: string }> }) {
  await requirePage("salaries.view");
  const userId = Number((await params).userId);
  const raw = (await searchParams).m;
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : currentMonth();
  const [y, mm] = month.split("-").map(Number);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) notFound();
  const b = await salaryBreakdown(userId, month);
  const rule = user.salaryType === "PERCENT" ? `${user.salaryAmount}%` : `${money(user.salaryAmount)} / o'quvchi`;

  return (
    <>
      <Link href={`/salaries?m=${month}`} className="label-mono hover:text-ink">← Ish haqi</Link>
      <PageHeader
        eyebrow={`${MONTHS[mm - 1]} ${y} · ${SALARY_TYPES[user.salaryType]?.label ?? ""} · ${rule}`}
        title={user.name}
        subtitle={
          b?.kind === "lessons" ? "Har bir dars kim o'tgan bo'lsa, o'shanga hisoblanadi"
          : b?.kind === "payments" ? "1-noyabrgacha: guruhlariga qilingan to'lovlardan foiz"
          : b?.kind === "students" ? "1-noyabrgacha: shu oyda hisob-kitob qilingan o'quvchilar soni bo'yicha"
          : "Bu xodimning ish haqi darslarga bog'liq emas"
        }
      />
      {b && (
        <div className="card md:overflow-x-auto">
          {b.kind === "lessons" && (
            <table className="table table-stack">
              <thead><tr><th>O&apos;quvchi</th><th>Guruh</th><th className="text-right">Darslar</th><th className="text-right">Darslar qiymati</th><th className="text-right">Ulush</th></tr></thead>
              <tbody>
                {b.rows.map((r) => (
                  <tr key={`${r.groupId}-${r.studentId}`}>
                    <td className="font-medium max-md:text-base">{r.studentName}</td>
                    <td data-label="Guruh">{r.groupName}</td>
                    <td data-label="Darslar" className="text-right font-mono">{r.lessons}/{r.lessonsInMonth}</td>
                    <td data-label="Qiymati" className="text-right">{money(r.value)}</td>
                    <td data-label="Ulush" className="text-right font-semibold">{money(r.rounded)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {b.kind === "payments" && (
            <table className="table table-stack">
              <thead><tr><th>Sana</th><th>O&apos;quvchi</th><th>Guruh</th><th className="text-right">To&apos;lov</th></tr></thead>
              <tbody>
                {b.rows.map((r, i) => (
                  <tr key={i}>
                    <td data-label="Sana" className="text-muted">{date(r.date)}</td>
                    <td className="font-medium max-md:order-first max-md:text-base">{r.studentName}</td>
                    <td data-label="Guruh">{r.groupName}</td>
                    <td data-label="To'lov" className="text-right">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {b.kind === "students" && (
            <table className="table table-stack">
              <thead><tr><th>O&apos;quvchi</th><th>Guruh</th></tr></thead>
              <tbody>
                {b.rows.map((r, i) => (
                  <tr key={i}><td className="font-medium max-md:text-base">{r.studentName}</td><td data-label="Guruh">{r.groupName}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {b.rows.length === 0 && <Empty text="Bu oyda hisoblanadigan darslar yo'q" />}
          <div className="flex items-center justify-between border-t border-line px-4 py-4 md:px-5">
            <span className="label-mono">Jami ish haqi (bonuslarsiz)</span>
            <span className="text-lg font-semibold">{money(b.total)}</span>
          </div>
        </div>
      )}
    </>
  );
}
