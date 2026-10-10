import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { db } from "@/lib/db";
import { centreDay } from "@/lib/membership-db";
import { requirePage } from "@/lib/auth";
import { can, canSeeBalances, groupScope, studentScope } from "@/lib/access";
import { balance } from "@/lib/billing";
import { membershipInclude } from "@/lib/billing-include";
import { date, isoDate, money } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { StudentFields } from "@/components/forms";
import { BalanceBadge, Empty, Field, PageHeader, Segmented, SubmitRow } from "@/components/ui";
import { createStudent } from "../actions";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const user = await requirePage("students.view");
  const { q = "", status = "active" } = await searchParams;
  const showBalance = canSeeBalances(user);
  const [students, groups] = await Promise.all([
    db.student.findMany({
      where: {
        AND: [
          studentScope(user),
          q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {},
          status === "active" ? { groups: { some: { leftAt: null } } } : status === "inactive" ? { groups: { none: { leftAt: null } } } : {},
        ],
      },
      include: {
        payments: { select: { amount: true } },
        groups: { include: membershipInclude },
      },
      orderBy: { name: "asc" },
    }),
    db.group.findMany({ where: { status: "ACTIVE", ...groupScope(user) }, include: { course: true }, orderBy: { name: "asc" } }),
  ]);

  const tabs = [
    { key: "active", label: "Faol" },
    { key: "inactive", label: "Guruhsiz / chiqib ketgan" },
    { key: "all", label: "Barchasi" },
  ];

  return (
    <>
      <PageHeader title="O'quvchilar" subtitle={`${students.length} ta o'quvchi`}>
        {can(user, "students.manage") && <Modal title="Yangi o'quvchi" trigger={<><Plus className="h-4 w-4" /> O&apos;quvchi qo&apos;shish</>}>
          <form action={createStudent} className="space-y-3">
            <StudentFields />
            <Field label="Guruhga qo'shish">
              <select name="groupId" className="input">
                <option value="">Hozircha guruhsiz</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name} — {g.course.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Holati">
                <select name="mode" className="input" defaultValue="TRIAL">
                  <option value="TRIAL">Sinov darsi (bepul)</option>
                  <option value="ACTIVE">Faol (to&apos;lovli)</option>
                </select>
              </Field>
              <Field label="Qaysi kundan"><input type="date" name="joinedAt" className="input" defaultValue={isoDate(centreDay())} /></Field>
            </div>
            <SubmitRow />
          </form>
        </Modal>}
      </PageHeader>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <Segmented options={tabs.map((t) => ({ href: `/students?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`, label: t.label, active: status === t.key }))} />
          <form className="relative w-full sm:w-72">
            <input type="hidden" name="status" value={status} />
            <Search className="absolute top-3 left-3.5 h-4 w-4 text-faint" />
            <input name="q" defaultValue={q} placeholder="Ism yoki telefon..." className="input rounded-full pl-10" />
          </form>
        </div>
        <div className="md:overflow-x-auto">
          <table className="table table-stack">
            <thead><tr><th className="max-md:hidden">#</th><th>Ism</th><th>Telefon</th><th>Guruhlar</th>{showBalance && <th>Balans</th>}<th>Qo&apos;shilgan</th></tr></thead>
            <tbody>
              {students.map((s, i) => {
                const b = balance(s.groups, s.payments);
                const active = s.groups.filter((g) => !g.leftAt);
                return (
                  <tr key={s.id}>
                    <td className="font-mono text-faint max-md:hidden">{i + 1}</td>
                    <td><Link href={`/students/${s.id}`} className="font-medium hover:underline max-md:text-base">{s.name}</Link></td>
                    <td data-label="Telefon" className="font-mono text-muted">{s.phone}</td>
                    <td data-label="Guruhlar">
                      <div className="flex flex-wrap justify-end gap-1 md:justify-start">
                        {active.map((g) => <span key={g.id} className="badge border border-line-strong text-ink">{g.group.name}</span>)}
                        {active.length === 0 && <span className="text-faint">—</span>}
                      </div>
                    </td>
                    {showBalance && <td data-label="Balans"><BalanceBadge value={b} label={money(b)} /></td>}
                    <td data-label="Qo'shilgan" className="text-muted">{date(s.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {students.length === 0 && <Empty text="O'quvchi topilmadi" />}
        </div>
      </div>
    </>
  );
}
