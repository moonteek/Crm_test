import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Phone, Plus, Trash2, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { balance, monthsEnrolled } from "@/lib/billing";
import { date, GROUP_DAYS, isoDate, money, PAYMENT_METHODS } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { PaymentForm, StudentFields } from "@/components/forms";
import { Empty, Field, SubmitRow } from "@/components/ui";
import { addStudentToGroup, deletePayment, deleteStudent, removeStudentFromGroup, updateStudent } from "../../actions";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [student, allGroups, session] = await Promise.all([
    db.student.findUnique({
      where: { id },
      include: {
        groups: { include: { group: { include: { course: true, teacher: true } } }, orderBy: { joinedAt: "desc" } },
        payments: { include: { group: true }, orderBy: { date: "desc" } },
        attendance: true,
      },
    }),
    db.group.findMany({ where: { status: "ACTIVE" }, include: { course: true }, orderBy: { name: "asc" } }),
    getSession(),
  ]);
  if (!student) notFound();

  const b = balance(student.groups, student.payments);
  const present = student.attendance.filter((a) => a.present).length;
  const activeGroups = student.groups.filter((g) => !g.leftAt).map((g) => g.group);
  const isAdmin = session?.role === "ADMIN";

  return (
    <>
      <Link href="/students" className="text-sm text-slate-500 hover:text-brand-600">← O&apos;quvchilar</Link>
      <div className="mt-3 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
                {student.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold">{student.name}</h1>
                <p className="text-sm text-slate-500">ID: {student.id}</p>
              </div>
            </div>
            <dl className="mt-5 space-y-2 text-sm">
              <Row k="Telefon"><a href={`tel:${student.phone}`} className="flex items-center gap-1 hover:text-brand-600"><Phone className="h-3.5 w-3.5" />{student.phone}</a></Row>
              <Row k="Ota-ona">{student.parentPhone ?? "—"}</Row>
              <Row k="Tug'ilgan sana">{date(student.birthDate)}</Row>
              <Row k="Qo'shilgan">{date(student.createdAt)}</Row>
              <Row k="Davomat">{student.attendance.length ? `${Math.round((present / student.attendance.length) * 100)}% (${present}/${student.attendance.length})` : "—"}</Row>
              {student.note && <Row k="Izoh">{student.note}</Row>}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Modal title="Ma'lumotlarni tahrirlash" triggerClassName="btn-secondary" trigger={<><Pencil className="h-4 w-4" /> Tahrirlash</>}>
                <form action={updateStudent.bind(null, student.id)} className="space-y-3">
                  <StudentFields s={student} />
                  <SubmitRow />
                </form>
              </Modal>
              {isAdmin && (
                <form action={deleteStudent.bind(null, student.id)}>
                  <button className="btn-secondary text-rose-600"><Trash2 className="h-4 w-4" /> O&apos;chirish</button>
                </form>
              )}
            </div>
          </div>

          <div className="card p-5">
            <p className="text-sm text-slate-500">Balans</p>
            <p className={`mt-1 text-2xl font-bold ${b < 0 ? "text-rose-600" : "text-emerald-600"}`}>{money(b)}</p>
            <p className="mt-1 text-xs text-slate-500">{b < 0 ? "Qarzdorlik mavjud" : "Qarzdorlik yo'q"}</p>
            <div className="mt-4">
              <Modal title="To'lov qabul qilish" trigger={<><Wallet className="h-4 w-4" /> To&apos;lov qilish</>}>
                <PaymentForm studentId={student.id} groups={activeGroups} />
              </Modal>
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-semibold">Guruhlar</h2>
              <Modal title="Guruhga qo'shish" triggerClassName="btn-secondary" trigger={<><Plus className="h-4 w-4" /> Guruhga qo&apos;shish</>}>
                <form action={addStudentToGroup} className="space-y-3">
                  <input type="hidden" name="studentId" value={student.id} />
                  <Field label="Guruh">
                    <select name="groupId" className="input" required>
                      {allGroups.map((g) => <option key={g.id} value={g.id}>{g.name} — {g.course.name} ({g.time})</option>)}
                    </select>
                  </Field>
                  <Field label="Qo'shilish sanasi"><input type="date" name="joinedAt" className="input" defaultValue={isoDate(new Date())} /></Field>
                  <SubmitRow />
                </form>
              </Modal>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Guruh</th><th>Kurs</th><th>Jadval</th><th>Oylar</th><th>Holat</th><th></th></tr></thead>
                <tbody>
                  {student.groups.map((gs) => (
                    <tr key={gs.id}>
                      <td><Link href={`/groups/${gs.groupId}`} className="font-medium hover:text-brand-600">{gs.group.name}</Link></td>
                      <td>{gs.group.course.name}<p className="text-xs text-slate-500">{money(gs.group.course.price)} / oy</p></td>
                      <td>{GROUP_DAYS[gs.group.days]}<p className="text-xs text-slate-500">{gs.group.time}</p></td>
                      <td>{monthsEnrolled(gs.joinedAt, gs.leftAt)}</td>
                      <td>
                        {gs.leftAt
                          ? <span className="badge bg-slate-100 text-slate-600">Chiqgan {date(gs.leftAt)}</span>
                          : <span className="badge bg-emerald-100 text-emerald-700">Faol · {date(gs.joinedAt)}</span>}
                      </td>
                      <td>
                        {!gs.leftAt && (
                          <form action={removeStudentFromGroup.bind(null, gs.groupId, student.id)}>
                            <button className="text-xs text-rose-600 hover:underline">Chiqarish</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {student.groups.length === 0 && <Empty text="Guruhga biriktirilmagan" />}
            </div>
          </div>

          <div className="card">
            <h2 className="px-5 py-4 font-semibold">To&apos;lovlar tarixi</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Sana</th><th>Summa</th><th>Turi</th><th>Guruh</th><th>Izoh</th>{isAdmin && <th></th>}</tr></thead>
                <tbody>
                  {student.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{date(p.date)}</td>
                      <td className="font-semibold text-emerald-600">{money(p.amount)}</td>
                      <td>{PAYMENT_METHODS[p.method]}</td>
                      <td>{p.group?.name ?? "—"}</td>
                      <td className="text-slate-500">{p.note ?? ""}</td>
                      {isAdmin && (
                        <td>
                          <form action={deletePayment.bind(null, p.id)}>
                            <button className="text-slate-400 hover:text-rose-600" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>
                          </form>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {student.payments.length === 0 && <Empty text="To'lovlar yo'q" />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
