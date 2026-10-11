import Link from "next/link";
import { CalendarClock, Phone, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/access";
import { Modal } from "@/components/Modal";
import { Empty, Field, PageHeader, SubmitRow } from "@/components/ui";
import { createUser } from "../actions";
import { ExportButtons } from "@/components/ExportButtons";
import { centreToday } from "@/lib/schedule";
import { DAY_END, DAY_START, DAY_TYPE_LABEL, DAY_TYPES, HOURS, teacherGrid, todayDayType, type Cell, type DayType } from "@/lib/availability";

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const CELL: Record<Cell["state"], string> = { lesson: "bg-ink text-page", free: "bg-success-tint text-success", busy: "bg-danger-tint text-danger", unset: "border border-dashed border-line-strong" };

export default async function TeachersPage({ searchParams }: { searchParams: Promise<{ d?: string; h?: string }> }) {
  const user = await requirePage("teachers.view");
  const params = await searchParams;
  const day: DayType = DAY_TYPES.includes(params.d as DayType) ? (params.d as DayType) : todayDayType();
  const hour = Math.min(DAY_END - 1, Math.max(DAY_START, Number(params.h) || centreToday().hour + 1));
  const [teachers, teacherRole, activeGroups, slots] = await Promise.all([
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
    db.group.findMany({ where: { status: "ACTIVE" }, include: { course: { select: { lessonMin: true } } } }),
    db.teacherSlot.findMany(),
  ]);
  // every teacher's week for the chosen day type, and who is free / not set / busy at the chosen hour
  const lessons = activeGroups.map((g) => ({ ...g, minutes: g.course.lessonMin }));
  const weeks = teachers.map((t) => ({ t, row: teacherGrid(t.id, lessons, slots.filter((s) => s.userId === t.id))[day] }));
  const at = (states: Cell["state"][]) => weeks.filter((w) => states.includes(w.row.get(hour)!.state));
  const roles = can(user, "staff.manage") ? await db.role.findMany({ orderBy: { name: "asc" } }) : [];

  return (
    <>
      <PageHeader title="O'qituvchilar" subtitle={`${teachers.length} ta o'qituvchi`}>
        <ExportButtons href="/teachers/export" />
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
                <Link key={`a${g.id}`} href={`/groups/${g.id}`} className="badge bg-ink/5 text-ink hover:bg-ink/10">{g.name} · yordamchi</Link>
              ))}
              {t.groups.map((g) => (
                <Link key={g.id} href={`/groups/${g.id}`} className="badge border border-transparent bg-accent-tint text-accent-ink hover:border-accent-ink/40">{g.name} · {g.time}</Link>
              ))}
            </div>
            <Link href={`/availability?teacher=${t.id}`} className="btn-secondary mt-4 px-3 py-1.5 text-xs"><CalendarClock className="h-3.5 w-3.5" /> Vaqt jadvali</Link>
          </div>
        ))}
      </div>

      {teachers.length > 0 && (
        <section className="card mt-4 p-4 md:mt-6 md:p-5" aria-labelledby="free-teachers">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h2 id="free-teachers" className="font-semibold">Bo&apos;sh o&apos;qituvchilar</h2>
            <form className="flex flex-wrap items-center gap-2">
              <select name="d" defaultValue={day} className="input w-auto" aria-label="Kunlar">
                {DAY_TYPES.map((d) => <option key={d} value={d}>{DAY_TYPE_LABEL[d]}</option>)}
              </select>
              <select name="h" defaultValue={hour} className="input w-auto" aria-label="Soat">
                {HOURS.map((h) => <option key={h} value={h}>{hh(h)}–{hh(h + 1)}</option>)}
              </select>
              <button className="btn-secondary">Ko&apos;rsatish</button>
            </form>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {([["Bo'sh", ["free"], "text-success"], ["Belgilanmagan", ["unset"], "text-muted"], ["Band yoki dars", ["busy", "lesson"], "text-danger"]] as const).map(([title, states, cls]) => (
              <div key={title} className="rounded-xl border border-line bg-raised p-3">
                <p className={`label-mono mb-2 ${cls}`}>{title} · {at([...states]).length}</p>
                <ul className="space-y-1 text-sm">
                  {at([...states]).map(({ t, row }) => {
                    const c = row.get(hour)!;
                    return (
                      <li key={t.id} className="flex justify-between gap-2">
                        <Link href={`/availability?teacher=${t.id}&d=${day}`} className="truncate hover:underline">{t.name}</Link>
                        {c.state === "lesson" && <span className="shrink-0 text-xs text-muted">dars · {c.group}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="relative mt-4 overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface pr-2 text-left font-medium text-muted">{DAY_TYPE_LABEL[day]}</th>
                  {HOURS.map((h) => <th key={h} className={`min-w-10 font-mono font-normal ${h === hour ? "text-ink" : "text-faint"}`}>{String(h).padStart(2, "0")}</th>)}
                </tr>
              </thead>
              <tbody>
                {weeks.map(({ t, row }) => (
                  <tr key={t.id}>
                    <td className="sticky left-0 z-10 max-w-36 truncate bg-surface pr-2 font-medium">{t.name}</td>
                    {HOURS.map((h) => {
                      const c = row.get(h)!;
                      const label = c.state === "lesson" ? `Dars · ${c.group}` : c.state === "free" ? "Bo'sh" : c.state === "busy" ? "Band" : "Belgilanmagan";
                      return <td key={h} title={`${hh(h)}–${hh(h + 1)}: ${label}`} className={`h-7 rounded-md ${CELL[c.state]} ${h === hour ? "ring-1 ring-accent" : ""}`}><span className="sr-only">{label}</span></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {teachers.length === 0 && <div className="card"><Empty text="O'qituvchilar yo'q" /></div>}
    </>
  );
}
