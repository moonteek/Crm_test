import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Phone, Pin, Plus, Tags, Trash2, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { centreDay } from "@/lib/membership-db";
import { requirePage } from "@/lib/auth";
import { can, canSeeBalances, groupScope, studentScope } from "@/lib/access";
import { balance, priceNow, withHolidays } from "@/lib/billing";
import { holidayDays } from "@/lib/holidays-db";
import { statement } from "@/lib/statement";
import { upcomingPrice } from "@/lib/prices";
import { passed } from "@/lib/curriculum";
import { membershipInclude } from "@/lib/billing-include";
import { date, GENDERS, GROUP_DAYS, isoDate, money } from "@/lib/format";
import { studentHistory } from "@/lib/student-history";
import { Modal } from "@/components/Modal";
import { StudentFields } from "@/components/forms";
import { PaymentForm } from "@/components/PaymentForm";
import { Empty, Field, SubmitRow } from "@/components/ui";
import { MemberMenu } from "@/components/members/MemberMenu";
import { StatusBadge } from "@/components/members/StatusBadge";
import { toMemberData, toMemberGroup } from "@/components/members/types";
import { TagChip } from "@/components/students/TagChip";
import { NotesPanel } from "@/components/students/NotesPanel";
import { HistoryList } from "@/components/students/HistoryList";
import { DiscountDialog } from "@/components/students/DiscountDialog";
import { DiscountList } from "@/components/students/DiscountList";
import { PER_LESSON_FROM } from "@/lib/billing";
import { centreToday } from "@/lib/schedule";
import { addStudentToGroup, deletePayment, deleteStudent, setStudentTags, updateStudent } from "../../actions";

const TABS = [
  { key: "groups", label: "Guruhlar" },
  { key: "payments", label: "To'lovlar" },
  { key: "discounts", label: "Chegirma" },
  { key: "notes", label: "Eslatma" },
  { key: "exams", label: "Imtihonlar" },
  { key: "history", label: "Tarix" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePage("students.view");
  const id = Number((await params).id);
  const asked = (await searchParams).tab;
  const [student, allGroups] = await Promise.all([
    db.student.findFirst({
      where: { id, ...studentScope(user) },
      // the passport never leaves the server for staff who cannot edit students
      omit: { passport: !can(user, "students.manage") },
      include: {
        groups: {
          include: {
            events: { ...membershipInclude.events, include: { reason: true } },
            group: { include: { course: true, teacher: true, prices: true } },
            discounts: { include: { user: { select: { name: true } } }, orderBy: { from: "desc" } },
          },
          orderBy: { joinedAt: "desc" },
        },
        payments: { include: { group: true }, orderBy: { date: "desc" } },
        attendance: true,
        grades: { select: { score: true } },
        examResults: { include: { exam: true } },
        purchases: { include: { items: { include: { product: true } } }, orderBy: { date: "desc" } },
        tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
        notes: { include: { user: { select: { name: true } } }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] },
      },
    }),
    db.group.findMany({ where: { status: "ACTIVE", ...groupScope(user) }, include: { course: true, prices: true }, orderBy: { name: "asc" } }),
  ]);
  const reasons = await db.reason.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  if (!student) notFound();

  const holidays = await holidayDays();
  const groups = withHolidays(student.groups, holidays);
  const b = balance(groups, student.payments);
  const present = student.attendance.filter((a) => a.present).length;
  const avgGrade = student.grades.length ? student.grades.reduce((s, g) => s + g.score, 0) / student.grades.length : null;
  const examPct = student.examResults.length
    ? Math.round(student.examResults.reduce((s, r) => s + (r.score / r.exam.maxScore) * 100, 0) / student.examResults.length)
    : null;
  const activeGroups = student.groups.filter((g) => !g.leftAt).map((g) => g.group);
  const rows = statement(groups, student.payments);
  const allow = {
    manage: can(user, "students.manage"),
    remove: can(user, "students.delete"),
    pay: can(user, "payments.create"),
    payments: can(user, "payments.view"),
    deletePayment: can(user, "payments.delete"),
    balance: canSeeBalances(user),
    shop: can(user, "shop.view"),
    discount: can(user, "students.discount"),
  };
  // money tabs only for staff who see payments
  const tabs = TABS.filter((t) => (t.key !== "payments" && t.key !== "discounts") || allow.payments);
  const tab: Tab = tabs.some((t) => t.key === asked) ? (asked as Tab) : "groups";
  const pinned = student.notes.find((n) => n.pinned);
  const allTags = allow.manage ? await db.tag.findMany({ orderBy: { name: "asc" } }) : [];
  const history = tab === "history" ? await loadHistory(student.id, student.payments, allow.payments) : [];

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
              {student.phone2 && <Row k="Qo'shimcha telefon">{student.phone2}</Row>}
              <Row k="Ota-ona">{[student.parentName, student.parentPhone].filter(Boolean).join(" · ") || "—"}</Row>
              <Row k="Tug'ilgan sana">{date(student.birthDate)}</Row>
              <Row k="Qo'shilgan">{date(student.createdAt)}</Row>
              <Row k="Davomat">{student.attendance.length ? `${Math.round((present / student.attendance.length) * 100)}% (${present}/${student.attendance.length})` : "—"}</Row>
              <Row k="O'rtacha baho">{avgGrade === null ? "—" : `${avgGrade.toFixed(1)} / 5 (${student.grades.length} ta)`}</Row>
              <Row k="Imtihonlar">{examPct === null ? "—" : `${examPct}% (${student.examResults.length} ta)`}</Row>
              {student.gender && <Row k="Jinsi">{GENDERS[student.gender] ?? student.gender}</Row>}
              {student.school && <Row k="Maktab">{student.school}</Row>}
              {student.address && <Row k="Manzil">{student.address}</Row>}
              {student.source && <Row k="Qayerdan keldi">{student.source}</Row>}
              {allow.manage && student.passport && <Row k="Pasport / ID">{student.passport}</Row>}
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {student.tags.map(({ tag }) => <TagChip key={tag.id} name={tag.name} color={tag.color} />)}
              {allow.manage && allTags.length > 0 && (
                <Modal title="Teglar" triggerClassName="btn-ghost px-2 py-1 text-xs" trigger={<><Tags className="h-3.5 w-3.5" /> {student.tags.length ? "Teglar" : "Teg qo'shish"}</>}>
                  <form action={setStudentTags.bind(null, student.id)} className="space-y-3">
                    <div className="space-y-2">
                      {allTags.filter((t) => t.active || student.tags.some((x) => x.tagId === t.id)).map((t) => (
                        <label key={t.id} className="flex items-center gap-3 text-sm">
                          <input type="checkbox" name="tagId" value={t.id} defaultChecked={student.tags.some((x) => x.tagId === t.id)} className="h-4 w-4 accent-accent" />
                          <TagChip name={t.name} color={t.color} />
                          {!t.active && <span className="text-xs text-faint">o&apos;chirilgan</span>}
                        </label>
                      ))}
                    </div>
                    <SubmitRow />
                  </form>
                </Modal>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {allow.manage && <Modal title="Ma'lumotlarni tahrirlash" triggerClassName="btn-secondary" trigger={<><Pencil className="h-4 w-4" /> Tahrirlash</>}>
                <form action={updateStudent.bind(null, student.id)} className="space-y-3">
                  <StudentFields s={student} canManage={allow.manage} />
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
                <PaymentForm studentId={student.id} groups={activeGroups.map((g) => ({ id: g.id, name: g.name, price: priceNow(g) }))} balance={allow.balance ? b : null} />
              </Modal>
            </div>}
          </div>}

          {pinned && (
            <Link href={`/students/${student.id}?tab=notes`} className="card press block p-5 hover:border-line-strong">
              <p className="label-mono flex items-center gap-1.5"><Pin className="h-3.5 w-3.5" /> Eslatma</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{pinned.text}</p>
              <p className="label-mono mt-3">{date(pinned.createdAt)} · {pinned.user?.name ?? "Tizim"}</p>
            </Link>
          )}
        </div>

        <div className="space-y-6 xl:col-span-2">
          <nav className="card flex gap-1 overflow-x-auto px-3 pt-2" aria-label="O'quvchi bo'limlari">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={`/students/${student.id}?tab=${t.key}`}
                aria-current={tab === t.key ? "page" : undefined}
                className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${tab === t.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {t.label}{t.key === "notes" && student.notes.length > 0 && <span className="ml-1 text-faint">{student.notes.length}</span>}
              </Link>
            ))}
          </nav>

          {tab === "groups" && (
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
                    <Field label="Qaysi kundan"><input type="date" name="joinedAt" className="input" defaultValue={isoDate(centreDay())} /></Field>
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
                // level exams of this group the student did not pass (flag only — they stay in the group)
                const failed = student.examResults
                  .filter((r) => r.exam.groupId === gs.groupId && r.exam.level !== null && !passed(r.score, r.exam.maxScore, gs.group.course.passPercent))
                  .sort((a, b) => a.exam.date.getTime() - b.exam.date.getTime());
                return (
                  <div key={gs.id} className={`rounded-xl border p-4 ${gs.status === "LEFT" ? "border-line opacity-70" : "border-line-strong bg-raised"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/groups/${gs.groupId}`} className="block truncate font-semibold hover:underline">{gs.group.name}</Link>
                        <p className="truncate text-sm text-muted">{gs.group.course.name} · {money(priceNow(gs.group))} / oy{upcomingPrice(gs.group.prices, new Date()) && <span className="label-mono ml-2">{date(upcomingPrice(gs.group.prices, new Date())!.from)} dan: {money(upcomingPrice(gs.group.prices, new Date())!.price)}</span>}</p>
                      </div>
                      <MemberMenu
                        member={toMemberData(gs, { id: student.id, name: student.name }, { money: allow.balance, holidays })}
                        reasons={reasons}
                        groups={allGroups.map((g) => toMemberGroup(g))}
                        balance={allow.balance ? b : null}
                        canManage={allow.manage}
                        canPay={allow.pay}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <StatusBadge status={gs.status} />
                      {failed.length > 0 && <span className="badge bg-danger-tint text-danger">Imtihondan yiqilgan: {failed.length}</span>}
                    </div>
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
                    {failed.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                        {failed.map((r) => (
                          <li key={r.id} className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 truncate">{r.exam.title}</span>
                            <span className="shrink-0 font-mono text-xs text-danger">{r.score}/{r.exam.maxScore} · {date(r.exam.date)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            {student.groups.length === 0 && <Empty text="Guruhga biriktirilmagan" />}
          </div>
          )}

          {tab === "payments" && allow.payments && <div className="card">
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

          {tab === "payments" && allow.shop && student.purchases.length > 0 && <div className="card">
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

          {tab === "discounts" && allow.payments && (
            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <h2 className="font-semibold">Chegirmalar</h2>
                  <p className="text-sm text-muted">Har oy to&apos;lovdan ayiriladi; o&apos;qituvchi ulushiga ta&apos;sir qilmaydi</p>
                </div>
                {allow.discount && (
                  <DiscountDialog
                    groups={student.groups.filter((g) => !g.leftAt).map((g) => ({ id: g.id, name: g.group.name }))}
                    firstMonth={firstDiscountMonth()}
                  />
                )}
              </div>
              <DiscountList
                rows={student.groups.flatMap((g) => g.discounts.map((d) => ({ ...d, group: g.group.name }))).sort((a, b) => b.from.getTime() - a.from.getTime())}
                canManage={allow.discount}
              />
            </div>
          )}

          {tab === "notes" && (
            <div className="card">
              <NotesPanel studentId={student.id} notes={student.notes} canWrite={allow.manage} me={{ id: user.id, isAdmin: user.isAdmin }} />
            </div>
          )}

          {tab === "exams" && (
            <div className="card overflow-x-auto">
              <table className="table">
                <thead><tr><th>Imtihon</th><th>Sana</th><th className="text-right">Ball</th></tr></thead>
                <tbody>
                  {[...student.examResults].sort((a, b) => b.exam.date.getTime() - a.exam.date.getTime()).map((r) => {
                    const course = student.groups.find((g) => g.groupId === r.exam.groupId)?.group.course;
                    const fail = course ? !passed(r.score, r.exam.maxScore, course.passPercent) : false;
                    return (
                      <tr key={r.id}>
                        <td className="whitespace-normal">{r.exam.title}</td>
                        <td className="text-muted">{date(r.exam.date)}</td>
                        <td className={`text-right font-mono ${fail ? "text-danger" : ""}`}>{r.score}/{r.exam.maxScore}{fail && <span className="label-mono ml-2 text-danger">yiqildi</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {student.examResults.length === 0 && <Empty text="Imtihon natijalari yo'q" />}
            </div>
          )}

          {tab === "history" && <div className="card"><HistoryList items={history} /></div>}
        </div>
      </div>
    </>
  );
}

/** The student's timeline: group events and payments from their own tables, everything else from the activity log. */
async function loadHistory(studentId: number, payments: { date: Date; amount: number; method: string; group: { name: string } | null }[], showMoney: boolean) {
  const [events, logs] = await Promise.all([
    db.membershipEvent.findMany({
      where: { groupStudent: { studentId } },
      include: { groupStudent: { include: { group: { select: { name: true } } } }, user: { select: { name: true } }, reason: { select: { name: true } } },
    }),
    db.auditLog.findMany({ where: { studentId }, include: { user: { select: { name: true } } } }),
  ]);
  return studentHistory({
    events: events.map((e) => ({ date: e.date, createdAt: e.createdAt, type: e.type, group: e.groupStudent.group.name, user: e.user?.name ?? null, reason: e.reason?.name ?? null })),
    payments: payments.map((p) => ({ date: p.date, amount: p.amount, method: p.method, group: p.group?.name ?? null })),
    logs: logs.map((l) => ({ createdAt: l.createdAt, action: l.action, summary: l.summary, user: l.user?.name ?? null })),
  }, { showMoney });
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

/** The earliest month a discount may start: this month, but never before per-lesson billing (YYYY-MM). */
function firstDiscountMonth() {
  const t = centreToday();
  const now = t.year * 12 + (t.month - 1);
  const first = Math.max(now, PER_LESSON_FROM.getUTCFullYear() * 12 + PER_LESSON_FROM.getUTCMonth());
  return `${Math.floor(first / 12)}-${String((first % 12) + 1).padStart(2, "0")}`;
}
