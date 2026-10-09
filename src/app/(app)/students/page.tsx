import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can, canSeeBalances, groupScope, studentScope } from "@/lib/access";
import { balance } from "@/lib/billing";
import { date, money } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { StudentFields } from "@/components/forms";
import { BalanceBadge, Empty, Field, PageHeader, SubmitRow } from "@/components/ui";
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
        groups: { include: { group: { include: { course: true } } } },
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
            <SubmitRow />
          </form>
        </Modal>}
      </PageHeader>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={`/students?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`rounded-md px-3 py-1.5 text-sm ${status === t.key ? "bg-white font-medium shadow-sm" : "text-slate-600"}`}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <form className="relative w-full sm:w-72">
            <input type="hidden" name="status" value={status} />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input name="q" defaultValue={q} placeholder="Ism yoki telefon..." className="input pl-9" />
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>#</th><th>Ism</th><th>Telefon</th><th>Guruhlar</th>{showBalance && <th>Balans</th>}<th>Qo&apos;shilgan</th></tr></thead>
            <tbody>
              {students.map((s, i) => {
                const b = balance(s.groups, s.payments);
                const active = s.groups.filter((g) => !g.leftAt);
                return (
                  <tr key={s.id}>
                    <td className="text-slate-400">{i + 1}</td>
                    <td><Link href={`/students/${s.id}`} className="font-medium hover:text-brand-600">{s.name}</Link></td>
                    <td>{s.phone}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {active.map((g) => <span key={g.id} className="badge bg-brand-50 text-brand-700">{g.group.name}</span>)}
                        {active.length === 0 && <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    {showBalance && <td><BalanceBadge value={b} label={money(b)} /></td>}
                    <td>{date(s.createdAt)}</td>
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
