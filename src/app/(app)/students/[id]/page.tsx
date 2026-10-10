import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Phone, Plus, Trash2, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can, canSeeBalances, groupScope, studentScope } from "@/lib/access";
import { balance } from "@/lib/billing";
import { statement } from "@/lib/statement";
import { membershipInclude } from "@/lib/billing-include";
import { date, GROUP_DAYS, isoDate, money } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { PaymentForm, StudentFields } from "@/components/forms";
import { Empty, Field, SubmitRow } from "@/components/ui";
import { MemberMenu } from "@/components/members/MemberMenu";
import { StatusBadge } from "@/components/members/StatusBadge";
import { toMemberData } from "@/components/members/types";
import { addStudentToGroup, deletePayment, deleteStudent, updateStudent } from "../../actions";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("students.view");
  const id = Number((await params).id);
  const [student, allGroups] = await Promise.all([
    db.student.findFirst({
      where: { id, ...studentScope(user) },
      include: {
        groups: { include: { events: { ...membershipInclude.events, include: { reason: true } }, group: { include: { course: true, teacher: true } } }, orderBy: { joinedAt: "desc" } },
        payments: { include: { group: true }, orderBy: { date: "desc" } },
        attendance: true,
        grades: { select: { score: true } },
        examResults: { include: { exam: true } },
        purchases: { include: { items: { include: { product: true } } }, orderBy: { date: "desc" } },
      },
    }),
    db.group.findMany({ where: { status: "ACTIVE", ...groupScope(user) }, include: { course: true }, orderBy: { name: "asc" } }),
  ]);
  const reasons = await db.reason.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  if (!student) notFound();

  const b = balance(student.groups, student.payments);
  const present = student.attendance.filter((a) => a.present).length;
  const avgGrade = student.grades.length ? student.grades.reduce((s, g) => s + g.score, 0) / student.grades.length : null;
  const examPct = student.examResults.length
    ? Math.round(student.examResults.reduce((s, r) => s + (r.score / r.exam.maxScore) * 100, 0) / student.examResults.length)
    : null;
  const activeGroups = student.groups.filter((g) => !g.leftAt).map((g) => g.group);
  const rows = statement(student.groups, student.payments);
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
      <Link href="/students" className="label-mono hover:text-ink">← O&apos;quvchilar</Link>
      <div className="mt-3 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-xl font-semibold text-on-accent">
                {student.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight">{student.name}</h1>
                <p className="text-sm text-muted">ID: {student.id}</p>
              </div>
            </div>
            <dl className="mt-5 space-y-2 text-sm">
              <Row k="Telefon"><a href={`tel:${student.phone}`} className="flex items-center gap-1 hover:underline"><Phone className="h-3.5 w-3.5" />{student.phone}</a></Row>
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
                  <button className="btn-danger"><Trash2 className="h-4 w-4" /> O&apos;chirish</button>
                </form>
              ))}
            </div>
          </div>

          {allow.balance && <div className="card p-5">
            <p className="label-mono">Balans</p>
            <p className={`mt-1 text-2xl font-semibold tracking-tight ${b < 0 ? "text-danger" : "text-success"}`}>{money(b)}</p>
            <p className="mt-1 text-xs text-muted">{b < 0 ? "Qarzdorlik mavjud" : "Qarzdorlik yo'q"}</p>
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
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Holati">
                      <select name="mode" className="input" defaultValue="TRIAL">
                        <option value="TRIAL">Sinov darsi (bepul)</option>
                        <option value="ACTIVE">Faol (to&apos;lovli)</option>
                      </select>
                    </Field>
                    <Field label="Qaysi kundan"><input type="date" name="joinedAt" className="input" defaultValue={isoDate(new Date())} /></Field>
                  </div>
                  <SubmitRow />
                </form>
              </Modal>}
            </div>
            <div className="grid grid-cols-1 gap-3 px-4 pb-4 md:grid-cols-2 md:px-5 md:pb-5">
              {student.groups.map((gs) => {
                const first = (t: string) => gs.events.find((e) => e.type === t);
                const last = gs.events.at(-1);
                const activated = first("ACTIVATE");
                return (
                  <div key={gs.id} className={`rounded-xl border p-4 ${gs.status === "LEFT" ? "border-line opacity-70" : "border-line-strong bg-raised"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/groups/${gs.groupId}`} className="block truncate font-semibold hover:underline">{gs.group.name}</Link>
                        <p className="truncate text-sm text-muted">{gs.group.course.name} · {money(gs.group.course.price)} / oy</p>
                      </div>
                      <MemberMenu
                        member={toMemberData(gs, { id: student.id, name: student.name })}
                        reasons={reasons}
                        groups={allGroups.map((g) => ({ id: g.id, name: g.name, days: g.days, course: { name: g.course.name, price: g.course.price } }))}
                        balance={allow.balance ? b : null}
                        canManage={allow.manage}
                        canPay={allow.pay}
                      />
                    </div>
                    <div className="mt-3"><StatusBadge status={gs.status} /></div>
                    <dl className="mt-3 space-y-1 text-sm">
                      <Row k="Jadval">{GROUP_DAYS[gs.group.days]} · <span className="font-mono">{gs.group.time}</span></Row>
                      <Row k="Qo'shilgan">{date(gs.events[0]?.date ?? gs.joinedAt)}</Row>
                      {activated && <Row k="Faollashtirilgan">{date(activated.date)}</Row>}
                      {(gs.status === "FROZEN" || gs.status === "LEFT") && last && (
                        <Row k={gs.status === "FROZEN" ? "Muzlatilgan" : "Chiqgan"}>
                          {date(last.date)}{last.reason ? ` · ${last.reason.name}` : ""}
                        </Row>
                      )}
                    </dl>
                  </div>
                );
              })}
            </div>
            {student.groups.length === 0 && <Empty text="Guruhga biriktirilmagan" />}
          </div>

          {allow.payments && <div className="card">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-semibold">To&apos;lovlar va hisob</h2>
              {allow.balance && <span className={`font-semibold ${b < 0 ? "text-danger" : "text-success"}`}>{money(b)}</span>}
            </div>
            <div className="md:overflow-x-auto">
              <table className="table table-stack">
                <thead><tr><th>Sana</th><th>Amal</th><th>Guruh</th><th className="text-right">Summa</th>{allow.balance && <th className="text-right">Balans</th>}{allow.deletePayment && <th></th>}</tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td data-label="Sana" className="text-muted">{date(r.date)}</td>
                      <td className="max-md:order-first whitespace-normal">
                        <span className={r.kind === "event" ? "text-muted" : "font-medium"}>{r.label}</span>
                        {r.lessons && <span className="label-mono ml-2">{r.lessons}</span>}
                      </td>
                      <td data-label="Guruh">{r.groupName ?? "—"}</td>
                      <td data-label="Summa" className={`text-right font-semibold ${r.amount > 0 ? "text-success" : r.amount < 0 ? "text-danger" : "text-faint"}`}>
                        {r.amount === 0 ? "—" : `${r.amount > 0 ? "+" : "−"}${money(Math.abs(r.amount))}`}
                      </td>
                      {allow.balance && <td data-label="Balans" className="text-right font-mono text-xs">{money(r.balance)}</td>}
                      {allow.deletePayment && (
                        <td>
                          {r.paymentId && (
                            <form action={deletePayment.bind(null, r.paymentId)}>
                              <button className="text-faint hover:text-danger" aria-label="To'lovni o'chirish"><Trash2 className="h-4 w-4" /></button>
                            </form>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <Empty text="To'lovlar va hisoblar yo'q" />}
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
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
