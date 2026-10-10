import { db } from "./db";
import { EXPENSE_CATEGORIES, LEAD_STATUSES, PAYMENT_METHODS } from "./format";
import { salariesForMonth } from "./salary";

const SHORT_MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

export type Month = { key: string; label: string; from: Date; to: Date };
export type Period = { label: string; months: Month[]; from: Date; to: Date; prevFrom: Date; prevTo: Date };

function month(y: number, m: number): Month {
  const from = new Date(y, m, 1);
  return {
    key: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`,
    label: `${SHORT_MONTHS[from.getMonth()]} ${String(from.getFullYear()).slice(2)}`,
    from,
    to: new Date(from.getFullYear(), from.getMonth() + 1, 1),
  };
}

/** `range`: "3" | "6" | "12" (months ending this month) or a year like "2026". */
export function resolvePeriod(range?: string, now = new Date()): Period {
  let months: Month[];
  let label: string;
  if (range && /^\d{4}$/.test(range)) {
    const y = Number(range);
    months = Array.from({ length: 12 }, (_, i) => month(y, i));
    label = `${y}-yil`;
  } else {
    const n = [3, 6, 12].includes(Number(range)) ? Number(range) : 6;
    months = Array.from({ length: n }, (_, i) => month(now.getFullYear(), now.getMonth() - (n - 1 - i)));
    label = `Oxirgi ${n} oy`;
  }
  const from = months[0].from;
  const to = months.at(-1)!.to;
  const span = months.length;
  return { label, months, from, to, prevFrom: new Date(from.getFullYear(), from.getMonth() - span, 1), prevTo: from };
}

const inRange = (d: Date, from: Date, to: Date) => d >= from && d < to;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);
const pct = (a: number, b: number) => (b ? (a / b) * 100 : null);

export async function getAnalytics(period: Period, now = new Date()) {
  const { from, to, prevFrom, prevTo, months } = period;
  const span = { gte: prevFrom, lt: to };
  const [groups, enrollments, payments, attendance, grades, exams, expenses, leads, paidByStudent, students, shopSales] = await Promise.all([
    db.group.findMany({ include: { course: true, teacher: true } }),
    db.groupStudent.findMany({ include: { group: { include: { course: true } } } }),
    db.payment.findMany({ where: { date: span }, include: { group: { include: { course: true } } } }),
    db.attendance.findMany({ where: { date: span } }),
    db.grade.findMany({ where: { date: span } }),
    db.exam.findMany({ where: { date: span }, include: { results: true } }),
    db.expense.findMany({ where: { date: span } }),
    db.lead.findMany({ where: { createdAt: span }, include: { course: true } }),
    db.payment.groupBy({ by: ["studentId"], _sum: { amount: true } }),
    db.student.findMany({ select: { id: true, name: true, phone: true } }),
    db.sale.findMany({ where: { date: span }, include: { items: true } }),
  ]);
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const studentById = new Map(students.map((s) => [s.id, s]));

  // ----- enrollment helpers -----
  const activeDuring = (e: (typeof enrollments)[number], a: Date, b: Date) =>
    e.joinedAt < b && e.joinedAt < now && (!e.leftAt || e.leftAt >= a);
  const charged = (a: Date, b: Date, filter: (e: (typeof enrollments)[number]) => boolean = () => true) =>
    sum(enrollments.filter((e) => filter(e) && activeDuring(e, a, b)).map((e) => e.group.course.price));
  const activeStudentsAt = (t: Date) =>
    new Set(enrollments.filter((e) => e.joinedAt < t && (!e.leftAt || e.leftAt >= t)).map((e) => e.studentId)).size;
  const firstJoin = new Map<number, Date>();
  enrollments.forEach((e) => {
    const f = firstJoin.get(e.studentId);
    if (!f || e.joinedAt < f) firstJoin.set(e.studentId, e.joinedAt);
  });
  const newStudents = (a: Date, b: Date) => [...firstJoin.values()].filter((d) => inRange(d, a, b)).length;
  // Leaving a FINISHED group counts as graduating; leaving an active group is a dropout.
  const isGraduation = (e: (typeof enrollments)[number]) => groupById.get(e.groupId)?.status === "FINISHED";
  const graduated = (a: Date, b: Date) =>
    new Set(enrollments.filter((e) => e.leftAt && inRange(e.leftAt, a, b) && isGraduation(e)).map((e) => e.studentId)).size;
  const leftStudents = (a: Date, b: Date) => {
    const left = new Set(enrollments.filter((e) => e.leftAt && inRange(e.leftAt, a, b) && !isGraduation(e)).map((e) => e.studentId));
    // only count students who are no longer in any group at the end of the window
    const stillActive = new Set(enrollments.filter((e) => e.joinedAt < b && (!e.leftAt || e.leftAt >= b)).map((e) => e.studentId));
    return [...left].filter((id) => !stillActive.has(id)).length;
  };
  /** Share of students enrolled at the start of the period who are still enrolled at its end (graduates excluded). */
  const retention = (groupIds: Set<number>) => {
    const cohort = enrollments.filter((e) => groupIds.has(e.groupId) && !isGraduation(e) && e.joinedAt < from && (!e.leftAt || e.leftAt >= from));
    const end = to < now ? to : now;
    return cohort.length ? pct(cohort.filter((e) => !e.leftAt || e.leftAt >= end).length, cohort.length) : null;
  };
  const monthlyCharge = (a: Date, b: Date) => (b > now && a > now ? 0 : charged(a, b));

  // ----- per-window metrics -----
  const windowStats = (a: Date, b: Date) => {
    const pays = payments.filter((p) => inRange(p.date, a, b));
    const att = attendance.filter((x) => inRange(x.date, a, b));
    const gr = grades.filter((x) => inRange(x.date, a, b));
    const ex = exams.filter((x) => inRange(x.date, a, b)).flatMap((e) => e.results.map((r) => (r.score / e.maxScore) * 100));
    const exp = expenses.filter((x) => inRange(x.date, a, b));
    const ld = leads.filter((l) => inRange(l.createdAt, a, b));
    const tuition = sum(pays.map((p) => p.amount));
    const shop = shopSales.filter((x) => inRange(x.date, a, b));
    const shopIncome = sum(shop.map((x) => x.total));
    const income = tuition + shopIncome;
    const expense = sum(exp.map((e) => e.amount));
    let chargedTotal = 0;
    for (const m of monthsBetween(a, b)) chargedTotal += monthlyCharge(m.from, m.to);
    return {
      income, tuition, shopIncome, expense, profit: income - expense,
      shopGrossProfit: shopIncome - sum(shop.flatMap((x) => x.items).map((i) => i.cost * i.qty)),
      charged: chargedTotal,
      collectionRate: pct(tuition, chargedTotal),
      activeStudents: activeStudentsAt(b < now ? b : now),
      newStudents: newStudents(a, b),
      leftStudents: leftStudents(a, b),
      graduated: graduated(a, b),
      attendanceRate: pct(att.filter((x) => x.present).length, att.length),
      avgGrade: avg(gr.map((g) => g.score)),
      examAvg: avg(ex),
      leads: ld.length,
      leadsWon: ld.filter((l) => l.status === "WON").length,
      conversion: pct(ld.filter((l) => l.status === "WON").length, ld.length),
    };
  };

  const current = windowStats(from, to);
  const previous = windowStats(prevFrom, prevTo);
  const monthly = months.map((m) => ({ ...windowStats(m.from, m.to), key: m.key, label: m.label }));

  // ----- payments -----
  const curPays = payments.filter((p) => inRange(p.date, from, to));
  const byMethod = Object.entries(PAYMENT_METHODS).map(([k, label]) => ({ label, value: sum(curPays.filter((p) => p.method === k).map((p) => p.amount)) }));
  const courseTotals = new Map<string, number>();
  curPays.forEach((p) => {
    const name = p.group?.course.name ?? "Guruhsiz";
    courseTotals.set(name, (courseTotals.get(name) ?? 0) + p.amount);
  });
  const byCourse = [...courseTotals].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  // per group, used by several tabs
  const groupRows = groups
    .filter((g) => g.status === "ACTIVE" || enrollments.some((e) => e.groupId === g.id && activeDuring(e, from, to)))
    .map((g) => {
      const inGroup = (e: (typeof enrollments)[number]) => e.groupId === g.id;
      let exp = 0;
      for (const m of months) if (m.from < now) exp += charged(m.from, m.to, inGroup);
      const collected = sum(curPays.filter((p) => p.groupId === g.id).map((p) => p.amount));
      const att = attendance.filter((a) => a.groupId === g.id && inRange(a.date, from, to));
      const gr = grades.filter((x) => x.groupId === g.id && inRange(x.date, from, to));
      const ex = exams.filter((e) => e.groupId === g.id && inRange(e.date, from, to)).flatMap((e) => e.results.map((r) => (r.score / e.maxScore) * 100));
      const left = g.status === "FINISHED" ? 0 : enrollments.filter((e) => inGroup(e) && e.leftAt && inRange(e.leftAt, from, to)).length;
      return {
        id: g.id, name: g.name, course: g.course.name, teacherId: g.teacherId, teacher: g.teacher?.name ?? "—",
        students: enrollments.filter((e) => inGroup(e) && !e.leftAt).length,
        expected: exp, collected, collectionRate: pct(collected, exp),
        attendanceRate: pct(att.filter((a) => a.present).length, att.length), lessonsMarked: att.length,
        avgGrade: avg(gr.map((x) => x.score)), examAvg: avg(ex),
        left, retention: retention(new Set([g.id])),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // all-time balances → debtors
  const paidMap = new Map(paidByStudent.map((p) => [p.studentId, p._sum.amount ?? 0]));
  const chargedAllTime = new Map<number, number>();
  enrollments.forEach((e) => {
    const end = e.leftAt && e.leftAt < now ? e.leftAt : now;
    const months = end < e.joinedAt ? 0 : (end.getFullYear() - e.joinedAt.getFullYear()) * 12 + end.getMonth() - e.joinedAt.getMonth() + 1;
    chargedAllTime.set(e.studentId, (chargedAllTime.get(e.studentId) ?? 0) + months * e.group.course.price);
  });
  const debtors = [...chargedAllTime]
    .map(([id, c]) => ({ id, debt: c - (paidMap.get(id) ?? 0) }))
    .filter((d) => d.debt > 0)
    .sort((a, b) => b.debt - a.debt)
    .map((d) => ({ ...d, name: studentById.get(d.id)?.name ?? "?", phone: studentById.get(d.id)?.phone ?? "" }));

  // ----- attendance -----
  const curAtt = attendance.filter((a) => inRange(a.date, from, to));
  const byWeekday = [1, 2, 3, 4, 5, 6].map((wd) => {
    const xs = curAtt.filter((a) => a.date.getUTCDay() === wd);
    return { label: WEEKDAYS[wd], value: pct(xs.filter((a) => a.present).length, xs.length) ?? 0, n: xs.length };
  }).filter((d) => d.n > 0);
  const perStudentAtt = new Map<number, { p: number; n: number }>();
  curAtt.forEach((a) => {
    const s = perStudentAtt.get(a.studentId) ?? { p: 0, n: 0 };
    s.n++; if (a.present) s.p++;
    perStudentAtt.set(a.studentId, s);
  });
  const atRiskAttendance = [...perStudentAtt]
    .filter(([, s]) => s.n >= 4 && s.p / s.n < 0.7)
    .map(([id, s]) => ({ id, name: studentById.get(id)?.name ?? "?", rate: (s.p / s.n) * 100, missed: s.n - s.p, marked: s.n }))
    .sort((a, b) => a.rate - b.rate);

  // ----- grades -----
  const curGrades = grades.filter((g) => inRange(g.date, from, to));
  const distribution = [5, 4, 3, 2, 1].map((n) => ({ label: `${n}`, value: curGrades.filter((g) => g.score === n).length }));
  const perStudentGrade = new Map<number, number[]>();
  curGrades.forEach((g) => perStudentGrade.set(g.studentId, [...(perStudentGrade.get(g.studentId) ?? []), g.score]));
  const perStudentExam = new Map<number, number[]>();
  exams.filter((e) => inRange(e.date, from, to)).forEach((e) =>
    e.results.forEach((r) => perStudentExam.set(r.studentId, [...(perStudentExam.get(r.studentId) ?? []), (r.score / e.maxScore) * 100])),
  );
  const studentPerf = [...new Set([...perStudentGrade.keys(), ...perStudentExam.keys()])].map((id) => ({
    id, name: studentById.get(id)?.name ?? "?",
    avgGrade: avg(perStudentGrade.get(id) ?? []), grades: perStudentGrade.get(id)?.length ?? 0,
    examAvg: avg(perStudentExam.get(id) ?? []),
    attendance: perStudentAtt.has(id) ? (perStudentAtt.get(id)!.p / perStudentAtt.get(id)!.n) * 100 : null,
  }));
  const topStudents = studentPerf.filter((s) => s.grades >= 3).sort((a, b) => (b.avgGrade ?? 0) - (a.avgGrade ?? 0) || (b.examAvg ?? 0) - (a.examAvg ?? 0)).slice(0, 10);
  const struggling = studentPerf
    .filter((s) => (s.grades >= 3 && (s.avgGrade ?? 5) < 3.5) || (s.examAvg !== null && s.examAvg < 60))
    .sort((a, b) => (a.avgGrade ?? 5) - (b.avgGrade ?? 5));

  // ----- teachers -----
  const salaryByUser = new Map<number, number>();
  for (const m of months) {
    if (m.from > now) continue;
    for (const r of await salariesForMonth(m.key)) salaryByUser.set(r.userId, (salaryByUser.get(r.userId) ?? 0) + r.accrued);
  }
  const teacherIds = [...new Set(groups.map((g) => g.teacherId).filter((x): x is number => x !== null))];
  const teacherNames = new Map(groups.filter((g) => g.teacher).map((g) => [g.teacherId!, g.teacher!.name]));
  const teacherRows = teacherIds.map((tid) => {
    const rows = groupRows.filter((g) => g.teacherId === tid);
    const gIds = new Set(groups.filter((g) => g.teacherId === tid).map((g) => g.id));
    const att = curAtt.filter((a) => gIds.has(a.groupId));
    const gr = curGrades.filter((g) => gIds.has(g.groupId));
    const ex = exams.filter((e) => gIds.has(e.groupId) && inRange(e.date, from, to)).flatMap((e) => e.results.map((r) => (r.score / e.maxScore) * 100));
    const collected = sum(rows.map((r) => r.collected));
    const salary = salaryByUser.get(tid) ?? 0;
    return {
      id: tid, name: teacherNames.get(tid) ?? "?",
      groups: rows.filter((r) => groupById.get(r.id)?.status === "ACTIVE").length,
      students: sum(rows.map((r) => r.students)),
      attendanceRate: pct(att.filter((a) => a.present).length, att.length),
      avgGrade: avg(gr.map((g) => g.score)), examAvg: avg(ex),
      collected, salary, salaryShare: pct(salary, collected),
      retention: retention(gIds),
    };
  }).sort((a, b) => b.collected - a.collected);

  // ----- leads -----
  const curLeads = leads.filter((l) => inRange(l.createdAt, from, to));
  const sources = [...new Set(curLeads.map((l) => l.source ?? "Noma'lum"))];
  const leadSources = sources.map((src) => {
    const xs = curLeads.filter((l) => (l.source ?? "Noma'lum") === src);
    const won = xs.filter((l) => l.status === "WON").length;
    return { source: src, total: xs.length, won, lost: xs.filter((l) => l.status === "LOST").length, conversion: pct(won, xs.length) };
  }).sort((a, b) => b.total - a.total);
  const funnel = LEAD_STATUSES.map((s) => ({ label: s.label, value: curLeads.filter((l) => l.status === s.key).length }));
  const lostReasons = [...new Set(curLeads.filter((l) => l.status === "LOST").map((l) => l.lostReason ?? "Ko'rsatilmagan"))]
    .map((r) => ({ label: r, value: curLeads.filter((l) => l.status === "LOST" && (l.lostReason ?? "Ko'rsatilmagan") === r).length }))
    .sort((a, b) => b.value - a.value);
  const courseInterest = [...new Set(curLeads.map((l) => l.course?.name ?? "Tanlanmagan"))]
    .map((c) => ({ label: c, value: curLeads.filter((l) => (l.course?.name ?? "Tanlanmagan") === c).length }))
    .sort((a, b) => b.value - a.value);

  // ----- finance -----
  const curExp = expenses.filter((e) => inRange(e.date, from, to));
  const expenseByCategory = Object.entries(EXPENSE_CATEGORIES)
    .map(([k, label]) => ({ label, value: sum(curExp.filter((e) => e.category === k).map((e) => e.amount)) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  const salaryTotal = sum(curExp.filter((e) => e.category === "SALARY").map((e) => e.amount));

  return {
    period: { label: period.label, from: from.toISOString().slice(0, 10), to: new Date(to.getTime() - 1).toISOString().slice(0, 10) },
    current, previous, monthly,
    payments: { byMethod, byCourse, debtTotal: sum(debtors.map((d) => d.debt)), debtors },
    groups: groupRows,
    attendance: { byWeekday, atRisk: atRiskAttendance },
    grades: { distribution, topStudents, struggling },
    teachers: teacherRows,
    leads: { sources: leadSources, funnel, courseInterest, lostReasons },
    finance: { expenseByCategory, salaryTotal, salaryShare: pct(salaryTotal, current.income) },
  };
}

function monthsBetween(a: Date, b: Date) {
  const out: { from: Date; to: Date }[] = [];
  for (let d = new Date(a.getFullYear(), a.getMonth(), 1); d < b; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    out.push({ from: d, to: new Date(d.getFullYear(), d.getMonth() + 1, 1) });
  }
  return out;
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;
