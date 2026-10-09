import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { balance } from "@/lib/billing";
import {
  assertGroupAccess, assertStudentAccess, can, canSeeBalances, groupScope, studentScope, type CurrentUser,
} from "@/lib/access";
import { EXPENSE_CATEGORIES, GROUP_DAYS, isoDate, LEAD_STATUSES, PAYMENT_METHODS } from "@/lib/format";
import type { Permission } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { getAnalytics, resolvePeriod } from "@/lib/analytics";
import { currentMonth, salariesForMonth, SALARY_TYPES } from "@/lib/salary";
import { money } from "@/lib/format";

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });

const enrollmentInclude = { groups: { include: { group: { include: { course: true } } } }, payments: { select: { amount: true } } } as const;

function monthRange(month?: string) {
  const now = new Date();
  const [y, m] = month ? month.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
}

/**
 * Builds an MCP server whose tools act as `user`. Tools the user's role does not
 * allow are not registered at all, so the AI client never sees them.
 */
export function buildServer(user: CurrentUser) {
  const server = new McpServer(
    { name: "algoritm-crm", version: "1.0.0" },
    {
      instructions:
        "Algoritm o'quv markazi CRM tizimi. Pul summalari so'mda. Sanalar YYYY-MM-DD, oylar YYYY-MM formatida. " +
        `Siz ${user.name} (${user.roleName}) nomidan ishlayapsiz va faqat uning roli ruxsat bergan amallarni bajara olasiz.`,
    },
  );
  const showBalance = canSeeBalances(user);
  const tool = <S extends z.ZodRawShape>(
    perm: Permission | Permission[],
    name: string,
    description: string,
    inputSchema: S,
    handler: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>,
    readOnly = true,
  ) => {
    if (![perm].flat().every((p) => can(user, p))) return;
    server.registerTool(
      name,
      { description, inputSchema, annotations: { readOnlyHint: readOnly } },
      (async (args: any) => {
        try {
          return json(await handler(args));
        } catch (e) {
          return { isError: true, content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }] };
        }
      }) as never,
    );
  };

  tool("dashboard.view", "get_overview", "Markaz bo'yicha umumiy ko'rsatkichlar: faol o'quvchilar, guruhlar, ochiq lidlar, shu oy tushum va xarajat, qarzdorlar soni.", {}, async () => {
    const { from } = monthRange();
    const [students, groups, leads, income, expense] = await Promise.all([
      db.student.findMany({ where: { AND: [{ groups: { some: { leftAt: null } } }, studentScope(user)] }, include: enrollmentInclude }),
      db.group.count({ where: { status: "ACTIVE", ...groupScope(user) } }),
      can(user, "leads.view") ? db.lead.count({ where: { status: { in: ["NEW", "CONTACTED", "TRIAL"] } } }) : null,
      can(user, "finance.view") ? db.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: from } } }) : null,
      can(user, "finance.view") ? db.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: from } } }) : null,
    ]);
    return {
      active_students: students.length,
      active_groups: groups,
      ...(leads !== null && { open_leads: leads }),
      ...(showBalance && { debtors: students.filter((s) => balance(s.groups, s.payments) < 0).length }),
      ...(income && expense && {
        this_month: { income: income._sum.amount ?? 0, expense: expense._sum.amount ?? 0, profit: (income._sum.amount ?? 0) - (expense._sum.amount ?? 0) },
      }),
    };
  });

  tool("students.view", "search_students", "O'quvchilarni ism yoki telefon bo'yicha qidirish. So'rovsiz chaqirilsa, faol o'quvchilar ro'yxatini qaytaradi.", {
    query: z.string().optional().describe("Ism yoki telefon raqam qismi"),
    limit: z.number().int().min(1).max(200).optional(),
  }, async ({ query, limit }) => {
    const students = await db.student.findMany({
      where: { AND: [studentScope(user), query ? { OR: [{ name: { contains: query } }, { phone: { contains: query } }] } : { groups: { some: { leftAt: null } } }] },
      include: enrollmentInclude,
      orderBy: { name: "asc" },
      take: limit ?? 50,
    });
    return students.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      groups: s.groups.filter((g) => !g.leftAt).map((g) => g.group.name),
      ...(showBalance && { balance: balance(s.groups, s.payments) }),
    }));
  });

  tool("students.view", "get_student", "Bitta o'quvchi haqida to'liq ma'lumot: guruhlari, davomati, balansi va to'lovlari.", {
    student_id: z.number().int(),
  }, async ({ student_id }) => {
    await assertStudentAccess(user, student_id);
    const s = await db.student.findUniqueOrThrow({
      where: { id: student_id },
      include: { ...enrollmentInclude, attendance: true },
    });
    const payments = can(user, "payments.view")
      ? await db.payment.findMany({ where: { studentId: student_id }, orderBy: { date: "desc" }, take: 24 })
      : null;
    const present = s.attendance.filter((a) => a.present).length;
    return {
      id: s.id, name: s.name, phone: s.phone, parent_phone: s.parentPhone,
      birth_date: s.birthDate && isoDate(s.birthDate), note: s.note,
      groups: s.groups.map((g) => ({
        group_id: g.groupId, name: g.group.name, course: g.group.course.name, monthly_price: g.group.course.price,
        joined: isoDate(g.joinedAt), left: g.leftAt && isoDate(g.leftAt),
      })),
      attendance: { lessons_marked: s.attendance.length, present, absent: s.attendance.length - present },
      ...(showBalance && { balance: balance(s.groups, s.payments) }),
      ...(payments && { recent_payments: payments.map((p) => ({ date: isoDate(p.date), amount: p.amount, method: PAYMENT_METHODS[p.method] })) }),
    };
  });

  tool("groups.view", "list_groups", "Guruhlar ro'yxati: kurs, o'qituvchi, jadval, xona va o'quvchilar soni.", {
    include_finished: z.boolean().optional().describe("Tugagan guruhlarni ham qo'shish"),
  }, async ({ include_finished }) => {
    const groups = await db.group.findMany({
      where: { ...groupScope(user), ...(include_finished ? {} : { status: "ACTIVE" }) },
      include: { course: true, teacher: true, room: true, _count: { select: { students: { where: { leftAt: null } } } } },
      orderBy: { name: "asc" },
    });
    return groups.map((g) => ({
      id: g.id, name: g.name, course: g.course.name, teacher: g.teacher?.name ?? null, room: g.room?.name ?? null,
      days: GROUP_DAYS[g.days], time: g.time, status: g.status, students: g._count.students, start_date: isoDate(g.startDate),
    }));
  });

  tool("groups.view", "get_group_attendance", "Guruh o'quvchilari va berilgan oydagi davomat (true = keldi, false = kelmadi).", {
    group_id: z.number().int(),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("YYYY-MM, standart: joriy oy"),
  }, async ({ group_id, month }) => {
    await assertGroupAccess(user, group_id);
    const now = new Date();
    const [y, m] = month ? month.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
    const from = new Date(Date.UTC(y, m - 1, 1));
    const to = new Date(Date.UTC(y, m, 1));
    const group = await db.group.findUniqueOrThrow({
      where: { id: group_id },
      include: {
        students: { where: { leftAt: null }, include: { student: true }, orderBy: { student: { name: "asc" } } },
        attendance: { where: { date: { gte: from, lt: to } } },
      },
    });
    return {
      group: group.name,
      students: group.students.map(({ student }) => ({
        student_id: student.id,
        name: student.name,
        attendance: Object.fromEntries(group.attendance.filter((a) => a.studentId === student.id).map((a) => [isoDate(a.date), a.present])),
      })),
    };
  });

  tool("attendance.mark", "mark_attendance", "Guruh darsi uchun davomat qilish. Ro'yxatda bo'lmagan o'quvchilarning belgisi o'zgarmaydi.", {
    group_id: z.number().int(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Dars sanasi, YYYY-MM-DD"),
    present_student_ids: z.array(z.number().int()).optional(),
    absent_student_ids: z.array(z.number().int()).optional(),
  }, async ({ group_id, date, present_student_ids = [], absent_student_ids = [] }) => {
    await assertGroupAccess(user, group_id);
    const members = new Set(
      (await db.groupStudent.findMany({ where: { groupId: group_id, leftAt: null } })).map((m) => m.studentId),
    );
    const day = new Date(date);
    const marks = [
      ...present_student_ids.map((id) => [id, true] as const),
      ...absent_student_ids.map((id) => [id, false] as const),
    ];
    const skipped = marks.filter(([id]) => !members.has(id)).map(([id]) => id);
    for (const [studentId, present] of marks) {
      if (!members.has(studentId)) continue;
      await db.attendance.upsert({
        where: { groupId_studentId_date: { groupId: group_id, studentId, date: day } },
        create: { groupId: group_id, studentId, date: day, present },
        update: { present },
      });
    }
    const g = await db.group.findUniqueOrThrow({ where: { id: group_id } });
    await logAction(user, "group.attendance", `Davomat (AI orqali): ${g.name}, ${date} — ${marks.length - skipped.length} ta belgi`);
    return { saved: marks.length - skipped.length, ...(skipped.length && { not_in_group: skipped }) };
  }, false);

  tool("leads.view", "list_leads", "Lidlar (potensial o'quvchilar) ro'yxati.", {
    status: z.enum(["NEW", "CONTACTED", "TRIAL", "WON", "LOST"]).optional(),
  }, async ({ status }) => {
    const leads = await db.lead.findMany({ where: status ? { status } : {}, include: { course: true }, orderBy: { createdAt: "desc" }, take: 200 });
    return leads.map((l) => ({
      id: l.id, name: l.name, phone: l.phone, source: l.source, course: l.course?.name ?? null,
      status: l.status, status_label: LEAD_STATUSES.find((s) => s.key === l.status)?.label, note: l.note, created: isoDate(l.createdAt),
    }));
  });

  tool("leads.manage", "create_lead", "Yangi lid qo'shish.", {
    name: z.string().min(1),
    phone: z.string().min(5),
    source: z.string().optional().describe("Instagram, Telegram, Tanish orqali, ..."),
    course_id: z.number().int().optional(),
    note: z.string().optional(),
  }, async ({ name, phone, source, course_id, note }) => {
    const lead = await db.lead.create({ data: { name, phone, source, courseId: course_id, note } });
    await logAction(user, "lead.create", `Yangi lid (AI orqali): ${name}`);
    return { created_lead_id: lead.id };
  }, false);

  tool("leads.manage", "update_lead_status", "Lid holatini o'zgartirish: NEW (yangi), CONTACTED (bog'lanildi), TRIAL (sinov darsi), WON (yozildi), LOST (rad etdi).", {
    lead_id: z.number().int(),
    status: z.enum(["NEW", "CONTACTED", "TRIAL", "WON", "LOST"]),
    note: z.string().optional(),
  }, async ({ lead_id, status, note }) => {
    const lead = await db.lead.update({ where: { id: lead_id }, data: { status, ...(note !== undefined && { note }) } });
    await logAction(user, "lead.status", `Lid "${lead.name}" holati (AI orqali): ${status}`);
    return { ok: true };
  }, false);

  tool("debtors.view", "list_debtors", "Qarzdor o'quvchilar ro'yxati, eng katta qarzdan boshlab.", {}, async () => {
    const students = await db.student.findMany({ where: studentScope(user), include: enrollmentInclude });
    return students
      .map((s) => ({ s, b: balance(s.groups, s.payments) }))
      .filter(({ b }) => b < 0)
      .sort((a, b) => a.b - b.b)
      .map(({ s, b }) => ({
        student_id: s.id, name: s.name, phone: s.phone, parent_phone: s.parentPhone, debt: -b,
        groups: s.groups.filter((g) => !g.leftAt).map((g) => g.group.name),
      }));
  });

  tool("payments.create", "record_payment", "O'quvchidan to'lov qabul qilish.", {
    student_id: z.number().int(),
    amount: z.number().int().positive().describe("So'mda"),
    method: z.enum(["CASH", "CARD", "TRANSFER"]).describe("CASH naqd, CARD karta, TRANSFER o'tkazma"),
    group_id: z.number().int().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    note: z.string().optional(),
  }, async ({ student_id, amount, method, group_id, date, note }) => {
    await assertStudentAccess(user, student_id);
    let groupId = group_id;
    if (!groupId) {
      const active = await db.groupStudent.findMany({ where: { studentId: student_id, leftAt: null } });
      if (active.length === 1) groupId = active[0].groupId;
    }
    const p = await db.payment.create({
      data: { studentId: student_id, amount, method, groupId, note, date: date ? new Date(date) : new Date() },
      include: { student: true },
    });
    await logAction(user, "payment.create", `To'lov (AI orqali): ${p.student.name} — ${money(amount)}`);
    return { payment_id: p.id };
  }, false);

  tool("payments.view", "list_payments", "Berilgan oydagi to'lovlar ro'yxati va jami summa.", {
    month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("YYYY-MM, standart: joriy oy"),
  }, async ({ month }) => {
    const { from, to } = monthRange(month);
    const payments = await db.payment.findMany({
      where: { date: { gte: from, lt: to }, student: studentScope(user) },
      include: { student: true, group: true },
      orderBy: { date: "desc" },
    });
    return {
      total: payments.reduce((s, p) => s + p.amount, 0),
      payments: payments.map((p) => ({
        id: p.id, date: isoDate(p.date), student: p.student.name, student_id: p.studentId,
        group: p.group?.name ?? null, amount: p.amount, method: PAYMENT_METHODS[p.method], note: p.note,
      })),
    };
  });

  tool("finance.view", "finance_summary", "Tushum, xarajat va foyda. Oy berilsa o'sha oy, aks holda yil bo'yicha oylar kesimida.", {
    year: z.number().int().optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  }, async ({ year, month }) => {
    if (month) {
      const { from, to } = monthRange(month);
      const [inc, exp] = await Promise.all([
        db.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: from, lt: to } } }),
        db.expense.findMany({ where: { date: { gte: from, lt: to } } }),
      ]);
      const expense = exp.reduce((s, e) => s + e.amount, 0);
      const byCategory: Record<string, number> = {};
      exp.forEach((e) => (byCategory[EXPENSE_CATEGORIES[e.category]] = (byCategory[EXPENSE_CATEGORIES[e.category]] ?? 0) + e.amount));
      return { month, income: inc._sum.amount ?? 0, expense, profit: (inc._sum.amount ?? 0) - expense, expense_by_category: byCategory };
    }
    const y = year ?? new Date().getFullYear();
    const [payments, expenses] = await Promise.all([
      db.payment.findMany({ where: { date: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } }, select: { amount: true, date: true } }),
      db.expense.findMany({ where: { date: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } }, select: { amount: true, date: true } }),
    ]);
    const months = Array.from({ length: 12 }, (_, i) => {
      const income = payments.filter((p) => p.date.getMonth() === i).reduce((s, p) => s + p.amount, 0);
      const expense = expenses.filter((e) => e.date.getMonth() === i).reduce((s, e) => s + e.amount, 0);
      return { month: `${y}-${String(i + 1).padStart(2, "0")}`, income, expense, profit: income - expense };
    });
    return { year: y, months };
  });

  tool("courses.view", "list_courses", "Kurslar ro'yxati va oylik narxlari.", {}, async () => {
    const courses = await db.course.findMany({ orderBy: { name: "asc" } });
    return courses.map((c) => ({ id: c.id, name: c.name, monthly_price: c.price, duration_months: c.durationMon, description: c.description }));
  });

  tool("analytics.view", "get_analytics", "Butun markaz bo'yicha analitika: tushum, yig'ilish darajasi, o'quvchilar oqimi, davomat, baholar, o'qituvchilar samaradorligi, lidlar va moliya. Oldingi davr bilan solishtirish ham beriladi.", {
    range: z.string().optional().describe("'3', '6', '12' (oxirgi N oy) yoki yil, masalan '2026'. Standart: 6"),
    section: z.enum(["overview", "payments", "groups", "attendance", "grades", "teachers", "leads", "finance", "all"]).optional()
      .describe("Kerakli bo'lim; standart: overview (umumiy ko'rsatkichlar va oylar kesimi)"),
  }, async ({ range, section = "overview" }) => {
    const a = await getAnalytics(resolvePeriod(range));
    const base = { period: a.period };
    if (!can(user, "finance.view")) {
      // academic-only roles: strip every money figure
      if (["payments", "finance", "all"].includes(section)) throw new Error("Moliyaviy analitika uchun ruxsat yo'q");
      const strip = <T extends object>(o: T) =>
        Object.fromEntries(Object.entries(o).filter(([k]) => !["income", "expense", "profit", "charged", "collectionRate", "collected", "expected", "salary", "salaryShare"].includes(k)));
      a.current = strip(a.current) as typeof a.current;
      a.previous = strip(a.previous) as typeof a.previous;
      a.monthly = a.monthly.map(strip) as typeof a.monthly;
      a.groups = a.groups.map(strip) as typeof a.groups;
      a.teachers = a.teachers.map(strip) as typeof a.teachers;
    }
    switch (section) {
      case "overview": return { ...base, current: a.current, previous_period: a.previous, monthly: a.monthly };
      case "payments": return { ...base, payments: { ...a.payments, debtors: a.payments.debtors.slice(0, 30) } };
      case "groups": return { ...base, groups: a.groups };
      case "attendance": return { ...base, attendance: a.attendance, groups: a.groups.map((g) => ({ name: g.name, attendance_rate: g.attendanceRate })) };
      case "grades": return { ...base, grades: a.grades, groups: a.groups.map((g) => ({ name: g.name, avg_grade: g.avgGrade, exam_avg: g.examAvg })) };
      case "teachers": return { ...base, teachers: a.teachers };
      case "leads": return { ...base, leads: a.leads, monthly: a.monthly.map((m) => ({ month: m.key, leads: m.leads, won: m.leadsWon })) };
      case "finance": return { ...base, finance: a.finance, monthly: a.monthly.map((m) => ({ month: m.key, income: m.income, expense: m.expense, profit: m.profit, charged: m.charged })) };
      default: return a;
    }
  });

  tool("salaries.view", "get_salaries", "Xodimlarning berilgan oy uchun hisoblangan, to'langan va qolgan ish haqi.", {
    month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("YYYY-MM, standart: joriy oy"),
  }, async ({ month }) => {
    const rows = await salariesForMonth(month ?? currentMonth());
    return rows.map((r) => ({ ...r, rule: SALARY_TYPES[r.salaryType].label }));
  });

  tool("grades.manage", "record_grades", "Dars uchun o'quvchilarga 1–5 baho qo'yish.", {
    group_id: z.number().int(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    grades: z.array(z.object({ student_id: z.number().int(), score: z.number().int().min(1).max(5) })),
  }, async ({ group_id, date, grades }) => {
    await assertGroupAccess(user, group_id);
    const members = new Set((await db.groupStudent.findMany({ where: { groupId: group_id, leftAt: null } })).map((m) => m.studentId));
    const day = new Date(date);
    let saved = 0;
    for (const g of grades) {
      if (!members.has(g.student_id)) continue;
      await db.grade.upsert({
        where: { groupId_studentId_date: { groupId: group_id, studentId: g.student_id, date: day } },
        create: { groupId: group_id, studentId: g.student_id, date: day, score: g.score },
        update: { score: g.score },
      });
      saved++;
    }
    const grp = await db.group.findUniqueOrThrow({ where: { id: group_id } });
    await logAction(user, "grade.set", `Baholar (AI orqali): ${grp.name}, ${date} — ${saved} ta`);
    return { saved, skipped: grades.length - saved };
  }, false);

  tool("audit.view", "list_activity", "Faoliyat jurnali: xodimlar qachon nima qilgani (to'lovlar, o'chirishlar, rol o'zgarishlari va h.k.).", {
    limit: z.number().int().min(1).max(200).optional(),
    search: z.string().optional().describe("Matn bo'yicha qidirish, masalan xodim yoki o'quvchi ismi"),
  }, async ({ limit, search }) => {
    const logs = await db.auditLog.findMany({
      where: search ? { OR: [{ summary: { contains: search } }, { user: { name: { contains: search } } }] } : {},
      include: { user: true }, orderBy: { createdAt: "desc" }, take: limit ?? 50,
    });
    return logs.map((l) => ({ at: l.createdAt.toISOString(), by: l.user?.name ?? null, action: l.action, summary: l.summary }));
  });

  return server;
}
