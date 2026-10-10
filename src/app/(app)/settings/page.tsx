import { redirect } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { date } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { Field, PageHeader, SubmitRow } from "@/components/ui";
import { createUser, setUserActive, updateUser } from "../actions";

type Role = { id: number; name: string };
type Staff = { name: string; phone: string; roleId: number; isTeacher: boolean; isSales: boolean };

function StaffFields({ roles, u }: { roles: Role[]; u?: Staff }) {
  return (
    <>
      <Field label="Ism familiya"><input name="name" className="input" required defaultValue={u?.name} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefon (login)"><input name="phone" className="input" required defaultValue={u?.phone} /></Field>
        <Field label="Rol">
          <select name="roleId" className="input" defaultValue={u?.roleId} required>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label={u ? "Yangi parol (o'zgartirmaslik uchun bo'sh qoldiring)" : "Parol"}>
        <input name="password" type="password" className="input" required={!u} minLength={6} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isTeacher" defaultChecked={u?.isTeacher} className="h-4 w-4 accent-ink" />
        Dars beradi (guruhlarga o&apos;qituvchi sifatida biriktirish mumkin)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isSales" defaultChecked={u?.isSales} className="h-4 w-4 accent-ink" />
        Sotuvchi (lidlar biriktiriladi, KPI belgilanadi)
      </label>
    </>
  );
}

export default async function StaffPage() {
  const me = await requireUser();
  if (!can(me, "staff.manage")) redirect(can(me, "mcp.use") ? "/settings/mcp" : "/no-access");
  const [users, roles] = await Promise.all([
    db.user.findMany({ include: { role: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Xodimlar" subtitle="Har bir xodim o'z roli ruxsat bergan bo'limlarni ko'radi">
        <Modal title="Yangi xodim" trigger={<><Plus className="h-4 w-4" /> Xodim qo&apos;shish</>}>
          <form action={createUser} className="space-y-3">
            <StaffFields roles={roles} />
            <SubmitRow />
          </form>
        </Modal>
      </PageHeader>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Ism</th><th>Telefon</th><th>Rol</th><th>Holat</th><th>Qo&apos;shilgan</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                <td className="font-medium">
                  {u.name}
                  {u.isTeacher && <span className="badge ml-2 bg-ink/5 text-ink">o&apos;qituvchi</span>}
                  {u.isSales && <span className="badge ml-2 bg-warning-tint text-warning">sotuvchi</span>}
                  {u.id === me.id && <span className="badge ml-2 bg-ink/5 text-muted">siz</span>}
                </td>
                <td>{u.phone}</td>
                <td><span className={`badge ${u.role.isSystem ? "bg-warning-tint text-warning" : "bg-accent-tint text-accent-ink"}`}>{u.role.name}</span></td>
                <td>
                  {u.active
                    ? <span className="badge bg-success-tint text-success">Faol</span>
                    : <span className="badge bg-danger-tint text-danger">Bloklangan</span>}
                </td>
                <td>{date(u.createdAt)}</td>
                <td>
                  <div className="flex items-center justify-end gap-3">
                    <Modal title="Xodimni tahrirlash" triggerClassName="text-faint hover:text-ink" trigger={<Pencil className="h-4 w-4" />}>
                      <form action={updateUser.bind(null, u.id)} className="space-y-3">
                        <StaffFields roles={roles} u={u} />
                        <SubmitRow />
                      </form>
                    </Modal>
                    {u.id !== me.id && (
                      <form action={setUserActive.bind(null, u.id, !u.active)}>
                        <button className={`text-xs hover:underline ${u.active ? "text-danger" : "text-success"}`}>
                          {u.active ? "Bloklash" : "Faollashtirish"}
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
