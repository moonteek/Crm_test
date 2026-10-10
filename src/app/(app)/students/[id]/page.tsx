import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Phone, Plus, Trash2, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can, canSeeBalances, groupScope, studentScope } from "@/lib/access";
import { balance, monthsEnrolled } from "@/lib/billing";
import { date, GROUP_DAYS, isoDate, money, PAYMENT_METHODS } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { PaymentForm, StudentFields } from "@/components/forms";
import { Empty, Field, SubmitRow } from "@/components/ui";
import { addStudentToGroup, deletePayment, deleteStudent, removeStudentFromGroup, updateStudent } from "../../actions";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("students.view");
  const id = Number((await params).id);
  const [student, allGroups] = await Promise.all([
    db.student.findFirst({
      where: { id, ...studentScope(user) },
      include: {
        groups: { include: { group: { include: { course: true, teacher: true } } }, orderBy: { joinedAt: "desc" } },
        payments: { include: { group: true }, orderBy: { date: "desc" } },
        attendance: true,
        grades: { select: { score: true } },
        examResults: { include: { exam: true } },
        purchases: { include: { items: { include: { product: true } } }, orderBy: { date: "desc" } },
      },
    }),
    db.group.findMany({ where: { status: "ACTIVE", ...groupScope(user) }, include: { course: true }, orderBy: { name: "asc" } }),
  ]);
  if (!student) notFound();

  const b = balance(student.groups, student.payments);
  const present = student.attendance.filter((a) => a.present).length;
  const avgGrade = student.grades.length ? student.grades.reduce((s, g) => s + g.score, 0) / student.grades.length : null;
  const examPct = student.examResults.length
    ? Math.round(student.examResults.reduce((s, r) => s + (r.score / r.exam.maxScore) * 100, 0) / student.examResults.length)
    : null;
  const activeGroups = student.groups.filter((g) => !g.leftAt).map((g) => g.group);
  const allow = {
    manage: can(user, "students.manage"),
    remove: can(user, "students.delete"),
    pay: can(user, "payments.create"),
    payments: can(user, "payments.view"),
    deletePayment: can(user, "payments.delete"),
    balance: canSeeBalances(user),
    shop: can(user, "shop.view"),
  };

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
              <Row k="O'rtacha baho">{avgGrade === null ? "—" : `${avgGrade.toFixed(1)} / 5 (${student.grades.length} ta)`}</Row>
              <Row k="Imtihonlar">{examPct === null ? "—" : `${examPct}% (${student.examResults.length} ta)`}</Row>
              {student.note && <Row k="Izoh">{student.note}</Row>}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              {allow.manage && <Modal title="Ma'lumotlarni tahrirlash" triggerClassName="btn-secondary" trigger={<><Pencil className="h-4 w-4" /> Tahrirlash</>}>
                <form action={updateStudent.bind(null, student.id)} className="space-y-3">
                  <StudentFields s={student} />
                  <SubmitRow />
                </form>
              </Modal>}
              {allow.remove && (student.payments.length ? (
                // payments are financial history and can't be deleted with the student
                <button disabled className="btn-secondary cursor-not-allowed opacity-50" title="To'lovlari bor o'quvchini o'chirib bo'lmaydi. Uni guruhlardan chiqaring">
                  <Trash2 className="h-4 w-4" /> O&apos;chirish
                </button>
              ) : (
                <form action={deleteStudent.bind(null, student.id)}>
                  <button className="btn-secondary text-rose-600"><Trash2 className="h-4 w-4" /> O&apos;chirish</button>
                </form>
              ))}
            </div>
          </div>

          {allow.balance && <div className="card p-5">
            <p className="text-sm text-slate-500">Balans</p>
            <p className={`mt-1 text-2xl font-bold ${b < 0 ? "text-rose-600" : "text-emerald-600"}`}>{money(b)}</p>
            <p className="mt-1 text-xs text-slate-500">{b < 0 ? "Qarzdorlik mavjud" : "Qarzdorlik yo'q"}</p>
            {allow.pay && <div className="mt-4">
              <Modal title="To'lov qabul qilish" trigger={<><Wallet className="h-4 w-4" /> To&apos;lov qilish</>}>
                <PaymentForm studentId={student.id} groups={activeGroups} />
              </Modal>
            </div>}
          </div>}
        </div>

        <div className="space-y-6 xl:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-semibold">Guruhlar</h2>
              {allow.manage && <Modal title="Guruhga qo'shish" triggerClassName="btn-secondary" trigger={<><Plus className="h-4 w-4" /> Guruhga qo&apos;shish</>}>
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
              </Modal>}
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
                        {allow.manage && !gs.leftAt && (
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

          {allow.payments && <div className="card">
            <h2 className="px-5 py-4 font-semibold">To&apos;lovlar tarixi</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Sana</th><th>Summa</th><th>Turi</th><th>Guruh</th><th>Izoh</th>{allow.deletePayment && <th></th>}</tr></thead>
                <tbody>
                  {student.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{date(p.date)}</td>
                      <td className="font-semibold text-emerald-600">{money(p.amount)}</td>
                      <td>{PAYMENT_METHODS[p.method]}</td>
                      <td>{p.group?.name ?? "—"}</td>
                      <td className="text-slate-500">{p.note ?? ""}</td>
                      {allow.deletePayment && (
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
          </div>}

          {allow.shop && student.purchases.length > 0 && <div className="card">
            <h2 className="px-5 py-4 font-semibold">Do&apos;kondan xaridlar</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Sana</th><th>Mahsulotlar</th><th className="text-right">Summa</th></tr></thead>
                <tbody>
                  {student.purchases.map((s) => (
                    <tr key={s.id}>
                      <td>{date(s.date)}</td>
                      <td className="whitespace-normal">{s.items.map((i) => `${i.product.name} × ${i.qty}`).join(", ")}</td>
                      <td className="text-right font-semibold">{money(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}
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
