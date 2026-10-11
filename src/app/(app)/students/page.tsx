import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { db } from "@/lib/db";
import { centreDay } from "@/lib/membership-db";
import { requirePage } from "@/lib/auth";
import { can, canSeeBalances, groupScope } from "@/lib/access";
import { isoDate, money } from "@/lib/format";
import { loadStudents } from "@/lib/lists/students";
import { PAGE_SIZES, parseStudentFilters, STUDENT_STATUSES } from "@/lib/student-filters";
import { Modal } from "@/components/Modal";
import { StudentFields } from "@/components/forms";
import { ExportButtons } from "@/components/ExportButtons";
import { TagChip } from "@/components/students/TagChip";
import { BalanceBadge, Empty, Field, PageHeader, SubmitRow } from "@/components/ui";
import { createStudent } from "../actions";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("students.view");
  const params = await searchParams;
  const f = parseStudentFilters(params, { canSeeBalances: canSeeBalances(user) });
  const [list, groups, courses, teachers, tags] = await Promise.all([
    loadStudents(user, f),
    db.group.findMany({ where: { status: "ACTIVE", ...groupScope(user) }, include: { course: true }, orderBy: { name: "asc" } }),
    db.course.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { isTeacher: true, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.tag.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const statuses = Object.entries(STUDENT_STATUSES).filter(([k]) => k !== "debtor" || list.showBalance);
  const filtered = Boolean(f.q || f.groupId || f.courseId || f.teacherId || f.tagId || f.status !== "active");
  // keeps every filter and changes one thing (page or page size)
  const link = (change: Record<string, string | number>) => {
    const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string"));
    for (const [k, v] of Object.entries(change)) q.set(k, String(v));
    return `/students?${q}`;
  };

  return (
    <>
      <PageHeader title="O'quvchilar" subtitle={`Jami: ${list.total}`}>
        <ExportButtons href="/students/export" />
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
        <form className="grid grid-cols-2 gap-2 border-b border-line p-4 md:grid-cols-4 xl:grid-cols-8" aria-label="Filtrlar">
          <div className="relative col-span-2">
            <Search className="absolute top-3 left-3.5 h-4 w-4 text-faint" />
            <input name="q" defaultValue={f.q} placeholder="Ism yoki telefon..." className="input pl-10" aria-label="Qidirish" />
          </div>
          <select name="status" defaultValue={f.status} className="input min-w-0" aria-label="Holati">
            {statuses.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select name="group" defaultValue={f.groupId ?? ""} className="input min-w-0" aria-label="Guruh">
            <option value="">Barcha guruhlar</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select name="course" defaultValue={f.courseId ?? ""} className="input min-w-0" aria-label="Kurs">
            <option value="">Barcha kurslar</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select name="teacher" defaultValue={f.teacherId ?? ""} className="input min-w-0" aria-label="O'qituvchi">
            <option value="">Barcha o&apos;qituvchilar</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select name="tag" defaultValue={f.tagId ?? ""} className="input min-w-0" aria-label="Teg">
            <option value="">Barcha teglar</option>
            {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input type="hidden" name="per" value={f.per} />
            <button className="btn-secondary flex-1">Filtrlash</button>
            {filtered && <Link href="/students" className="btn-ghost px-2">Tozalash</Link>}
          </div>
        </form>
        <div className="md:overflow-x-auto">
          <table className="table table-stack">
            <thead><tr><th className="max-md:hidden">#</th><th>Ism</th><th>Telefon</th><th>Guruhlar</th><th>O&apos;qituvchilar</th><th>Holati</th>{list.showBalance && <th>Balans</th>}</tr></thead>
            <tbody>
              {list.rows.map((s, i) => (
                <tr key={s.id}>
                  <td className="font-mono text-faint max-md:hidden">{(list.page - 1) * f.per + i + 1}</td>
                  <td>
                    <Link href={`/students/${s.id}`} className="font-medium hover:underline max-md:text-base">{s.name}</Link>
                    {s.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{s.tags.map(({ tag }) => <TagChip key={tag.id} name={tag.name} color={tag.color} />)}</div>}
                  </td>
                  <td data-label="Telefon" className="font-mono text-muted">{s.phone}</td>
                  <td data-label="Guruhlar">
                    <div className="flex flex-wrap justify-end gap-1 md:justify-start">
                      {s.current.map((g) => <span key={g.id} className="badge border border-line-strong text-ink">{g.group.name}</span>)}
                      {s.current.length === 0 && <span className="text-faint">—</span>}
                    </div>
                  </td>
                  <td data-label="O'qituvchilar" className="text-muted">{s.teachers.join(", ") || "—"}</td>
                  <td data-label="Holati" className="text-muted">{s.statusLabel}</td>
                  {list.showBalance && s.balance !== null && <td data-label="Balans"><BalanceBadge value={s.balance} label={money(s.balance)} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
          {list.rows.length === 0 && <Empty text="O'quvchi topilmadi" />}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-muted">
            Sahifada:
            {PAGE_SIZES.map((n) => (
              <Link key={n} href={link({ per: n, page: 1 })} aria-current={n === f.per ? "page" : undefined} className={`rounded-full px-2.5 py-1 ${n === f.per ? "bg-nav-active text-nav-active-ink" : "hover:text-ink"}`}>{n}</Link>
            ))}
          </div>
          {list.pages > 1 && (
            <div className="flex items-center gap-2">
              {list.page > 1 ? <Link href={link({ page: list.page - 1 })} className="btn-secondary px-2" aria-label="Oldingi sahifa"><ChevronLeft className="h-4 w-4" /></Link> : <span className="btn-secondary px-2 opacity-40" aria-hidden><ChevronLeft className="h-4 w-4" /></span>}
              <span className="font-mono text-muted">{list.page} / {list.pages}</span>
              {list.page < list.pages ? <Link href={link({ page: list.page + 1 })} className="btn-secondary px-2" aria-label="Keyingi sahifa"><ChevronRight className="h-4 w-4" /></Link> : <span className="btn-secondary px-2 opacity-40" aria-hidden><ChevronRight className="h-4 w-4" /></span>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
