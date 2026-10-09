import { Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { date, ROLES } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { Field, PageHeader, SubmitRow } from "@/components/ui";
import { createUser, deleteUser } from "../actions";

export default async function SettingsPage() {
  const session = await requireAdmin();
  const users = await db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });

  return (
    <>
      <PageHeader title="Sozlamalar" subtitle="Xodimlar va tizimga kirish huquqlari">
        <Modal title="Yangi xodim" trigger={<><Plus className="h-4 w-4" /> Xodim qo&apos;shish</>}>
          <form action={createUser} className="space-y-3">
            <Field label="Ism familiya"><input name="name" className="input" required /></Field>
            <Field label="Telefon (login)"><input name="phone" className="input" required /></Field>
            <Field label="Lavozim">
              <select name="role" className="input">
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Parol"><input name="password" type="password" className="input" required minLength={6} /></Field>
            <SubmitRow />
          </form>
        </Modal>
      </PageHeader>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Ism</th><th>Telefon</th><th>Lavozim</th><th>Qo&apos;shilgan</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td>{u.phone}</td>
                <td><span className="badge bg-brand-50 text-brand-700">{ROLES[u.role]}</span></td>
                <td>{date(u.createdAt)}</td>
                <td>
                  {u.id !== session.userId && (
                    <form action={deleteUser.bind(null, u.id)}>
                      <button className="text-slate-400 hover:text-rose-600" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
