import "server-only";
import { db } from "../db";
import { centreDay } from "../membership-db";
import { getRiskSettings } from "../risk-db";
import { CONTACT_RESULTS, filterRows, isContacted, membershipReasons, newestTrigger, type MembershipFacts, type RiskParams, type RiskRow } from "../risk";
import { fmtDate, type Table } from "../export";

const DAY = 86_400_000;

/** Every risky student (all tabs, no filters): one pass over active / trial memberships of running groups. */
async function riskyStudents(): Promise<RiskRow[]> {
  const s = await getRiskSettings();
  const today = centreDay();
  // the window and the period before it (falling grades); a run of absences is counted inside this range too
  const since = new Date(today.getTime() - (2 * s.days - 1) * DAY);
  const members = await db.groupStudent.findMany({
    where: { status: { in: ["ACTIVE", "TRIAL"] }, group: { status: "ACTIVE" } },
    select: {
      student: { select: { id: true, name: true, phone: true, parentPhone: true } },
      group: { select: { id: true, name: true, teacherId: true, teacher: { select: { name: true } }, course: { select: { passPercent: true } } } },
    },
  });
  if (!members.length) return [];
  const groupIds = [...new Set(members.map((m) => m.group.id))];
  const studentIds = [...new Set(members.map((m) => m.student.id))];
  const pair = { groupId: { in: groupIds }, studentId: { in: studentIds } };
  const [marks, grades, exams, contacts] = await Promise.all([
    db.attendance.findMany({ where: { ...pair, date: { gte: since } }, select: { groupId: true, studentId: true, date: true, present: true } }),
    db.grade.findMany({ where: { ...pair, date: { gte: since } }, select: { groupId: true, studentId: true, date: true, score: true } }),
    db.exam.findMany({
      where: { groupId: { in: groupIds }, level: { not: null } },
      select: { groupId: true, date: true, level: true, maxScore: true, results: { where: { studentId: { in: studentIds } }, select: { studentId: true, score: true } } },
    }),
    db.riskContact.findMany({ where: { studentId: { in: studentIds } }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } }),
  ]);

  const key = (groupId: number, studentId: number) => `${groupId}:${studentId}`;
  const facts = new Map<string, MembershipFacts>();
  const factsOf = (groupId: number, studentId: number, passPercent = 60) => {
    const k = key(groupId, studentId);
    if (!facts.has(k)) facts.set(k, { marks: [], grades: [], levelExams: [], passPercent });
    return facts.get(k)!;
  };
  for (const m of members) factsOf(m.group.id, m.student.id, m.group.course.passPercent);
  for (const a of marks) facts.get(key(a.groupId, a.studentId))?.marks.push({ date: a.date, present: a.present });
  for (const g of grades) facts.get(key(g.groupId, g.studentId))?.grades.push({ date: g.date, score: g.score });
  for (const e of exams) {
    for (const m of members.filter((x) => x.group.id === e.groupId)) {
      const r = e.results.find((x) => x.studentId === m.student.id);
      facts.get(key(e.groupId, m.student.id))!.levelExams.push({ date: e.date, level: e.level!, maxScore: e.maxScore, score: r?.score ?? null });
    }
  }
  const lastContact = new Map<number, (typeof contacts)[number]>();
  for (const c of contacts) if (!lastContact.has(c.studentId)) lastContact.set(c.studentId, c);

  const rows = new Map<number, RiskRow>();
  for (const m of members) {
    const reasons = membershipReasons(facts.get(key(m.group.id, m.student.id))!, s, today);
    if (!reasons.length) continue;
    const c = lastContact.get(m.student.id);
    const row = rows.get(m.student.id) ?? {
      student: m.student,
      groups: [],
      contact: c ? { at: c.createdAt, who: c.user?.name ?? null, result: c.result as keyof typeof CONTACT_RESULTS, comment: c.comment } : null,
      contacted: false,
      newest: today,
    };
    row.groups.push({ id: m.group.id, name: m.group.name, teacherId: m.group.teacherId, teacher: m.group.teacher?.name ?? null, reasons });
    rows.set(m.student.id, row);
  }
  return [...rows.values()].map((r) => {
    const all = r.groups.flatMap((g) => g.reasons);
    return { ...r, newest: newestTrigger(all)!, contacted: isContacted(all, r.contact ? centreDay(r.contact.at) : null) };
  });
}

/** The report page and its export: rows of the chosen tab and filters, counts per tab, the filter choices. */
export async function loadRisk(params: Record<string, string | undefined> = {}) {
  const p: RiskParams = { tab: params.tab, group: params.group, teacher: params.teacher, kind: params.kind };
  const all = await riskyStudents();
  const rows = filterRows(all, p);
  const counts = {
    open: filterRows(all, { ...p, tab: "open" }).length,
    done: filterRows(all, { ...p, tab: "done" }).length,
    all: filterRows(all, { ...p, tab: "all" }).length,
  };
  const groups = new Map<number, string>();
  const teachers = new Map<number, string>();
  for (const g of all.flatMap((r) => r.groups)) {
    groups.set(g.id, g.name);
    if (g.teacherId && g.teacher) teachers.set(g.teacherId, g.teacher);
  }
  const byName = (m: Map<number, string>) => [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  const table: Table = {
    title: "Xavfli o'quvchilar",
    columns: ["O'quvchi", "Telefon", "Ota-ona telefoni", "Guruh", "O'qituvchi", "Sabablar", "Oxirgi aloqa", "Natija", "Izoh"],
    rows: rows.flatMap((r) =>
      r.groups.map((g) => [
        r.student.name, r.student.phone, r.student.parentPhone, g.name, g.teacher, g.reasons.map((x) => x.label).join("; "),
        r.contact ? fmtDate(r.contact.at) : null, r.contact ? CONTACT_RESULTS[r.contact.result] ?? r.contact.result : null, r.contact?.comment ?? null,
      ]),
    ),
  };
  return { rows, counts, table, groups: byName(groups), teachers: byName(teachers) };
}

/** Risky students nobody has called about their newest problem yet (sidebar badge, dashboard card). */
export async function countOpenRisk(): Promise<number> {
  return (await riskyStudents()).filter((r) => !r.contacted).length;
}
