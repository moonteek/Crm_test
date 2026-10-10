import Link from "next/link";
import { Phone, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/access";
import { Modal } from "@/components/Modal";
import { Empty, Field, PageHeader, SubmitRow } from "@/components/ui";
import { createUser } from "../actions";

export default async function TeachersPage() {
  const user = await requirePage("teachers.view");
  const [teachers, teacherRole] = await Promise.all([
    db.user.findMany({
      where: { isTeacher: true, active: true },
      include: {
        role: true,
        groups: { where: { status: "ACTIVE" }, include: { _count: { select: { students: { where: { leftAt: null } } } } } },
        assistedGroups: { where: { status: "ACTIVE" } },
      },
      orderBy: { name: "asc" },
    }),
    db.role.findFirst({ where: { name: "O'qituvchi" } }),
  ]);
  const roles = can(user, "staff.manage") ? await db.role.findMany({ orderBy: { name: "asc" } }) : [];

  return (
    <>
      <PageHeader title="O'qituvchilar" subtitle={`${teachers.length} ta o'qituvchi`}>
        {can(user, "staff.manage") && (
          <Modal title="Yangi o'qituvchi" trigger={<><Plus className="h-4 w-4" /> O&apos;qituvchi qo&apos;shish</>}>
            <form action={createUser} className="space-y-3">
              <input type="hidden" name="isTeacher" value="on" />
              <Field label="Rol">
                <select name="roleId" className="input" defaultValue={teacherRole?.id}>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Ism familiya"><input name="name" className="input" required /></Field>
              <Field label="Telefon (login)"><input name="phone" className="input" required /></Field>
              <Field label="Parol"><input name="password" type="password" className="input" required minLength={6} /></Field>
              <SubmitRow />
            </form>
          </Modal>
        )}
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {teachers.map((t) => (
          <div key={t.id} className="card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-tint text-lg font-semibold text-accent-ink">{t.name.charAt(0)}</div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{t.name}</p>
                <p className="text-xs text-muted">{t.role.name}</p>
                <a href={`tel:${t.phone}`} className="flex items-center gap-1 text-sm text-muted hover:underline"><Phone className="h-3.5 w-3.5" />{t.phone}</a>
              </div>
            </div>
            <div className="mt-4 flex gap-4 text-sm">
              <p><span className="font-bold">{t.groups.length}</span> <span className="text-muted">guruh</span></p>
              <p><span className="font-bold">{t.groups.reduce((s, g) => s + g._count.students, 0)}</span> <span className="text-muted">o&apos;quvchi</span></p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {t.assistedGroups.map((g) => (
                <Link key={`a${g.id}`} href={`/groups/${g.id}`} className="badge bg-ink/5 text-ink hover:bg-ink/5">{g.name} · yordamchi</Link>
              ))}
              {t.groups.map((g) => (
                <Link key={g.id} href={`/groups/${g.id}`} className="badge bg-accent-tint text-accent-ink hover:bg-accent-tint">{g.name} · {g.time}</Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      {teachers.length === 0 && <div className="card"><Empty text="O'qituvchilar yo'q" /></div>}
    </>
  );
}
