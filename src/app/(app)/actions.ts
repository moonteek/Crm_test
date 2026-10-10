"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth";
import { assertGroupAccess, assertLeadAccess, assertStudentAccess, can, ForbiddenError } from "@/lib/access";
import { pickAssignee } from "@/lib/sales";
import { shiftMonth } from "@/lib/month";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { ACTIVITY_TYPES, KPI_METRICS, LEAD_STATUSES, money, PRODUCT_CATEGORIES } from "@/lib/format";
import { SALARY_TYPES } from "@/lib/salary";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optStr = (f: FormData, k: string) => str(f, k) || null;
const num = (f: FormData, k: string) => Number(str(f, k).replace(/\s/g, "")) || 0;
const optId = (f: FormData, k: string) => (str(f, k) ? Number(str(f, k)) : null);
const day = (f: FormData, k: string) => (str(f, k) ? new Date(str(f, k)) : null);

// ---------- Leads ----------
export async function createLead(f: FormData) {
  const user = await requirePermission("leads.manage");
  // salespeople own the leads they add; others pick a salesperson or let the CRM choose
  const choice = str(f, "assignedToId");
  const assignedToId = can(user, "leads.own") ? user.id : choice === "auto" ? await pickAssignee() : optId(f, "assignedToId");
  const lead = await db.lead.create({
    data: {
      name: str(f, "name"), phone: str(f, "phone"), source: optStr(f, "source"), courseId: optId(f, "courseId"), note: optStr(f, "note"),
      assignedToId, nextActionAt: new Date(),
    },
  });
  await logAction(user, "lead.create", `Yangi lid: ${lead.name} (${lead.source ?? "manba yo'q"})`);
  revalidatePath("/leads");
}

/** Changes a lead's status and records it in the lead's history. LOST needs a reason. */
export async function setLeadStatus(id: number, status: string, f?: FormData) {
  const user = await requirePermission("leads.manage");
  await assertLeadAccess(user, id);
  if (!LEAD_STATUSES.some((s) => s.key === status) || status === "WON") throw new Error("Noto'g'ri holat");
  const lostReason = status === "LOST" ? (f && str(f, "lostReason")) || "Boshqa" : null;
  const lead = await db.lead.update({
    where: { id },
    data: { status, lostReason, ...(status === "LOST" ? { nextActionAt: null } : {}) },
  });
  await db.leadActivity.create({
    data: { leadId: id, userId: user.id, type: "STATUS", result: status, text: lostReason ?? (f ? optStr(f, "text") : null) },
  });
  await logAction(user, "lead.status", `Lid "${lead.name}" holati: ${status}${lostReason ? ` (${lostReason})` : ""}`);
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

export async function assignLead(id: number, f: FormData) {
  const user = await requirePermission("leads.manage");
  if (can(user, "leads.own")) throw new ForbiddenError();
  const assignedToId = optId(f, "assignedToId");
  const lead = await db.lead.update({ where: { id }, data: { assignedToId }, include: { assignedTo: true } });
  await db.leadActivity.create({ data: { leadId: id, userId: user.id, type: "NOTE", text: `Biriktirildi: ${lead.assignedTo?.name ?? "hech kimga"}` } });
  await logAction(user, "lead.assign", `Lid "${lead.name}" → ${lead.assignedTo?.name ?? "biriktirilmagan"}`);
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

/** Logs a call / message / meeting / note and sets (or clears) the next follow-up. */
export async function addLeadActivity(id: number, f: FormData) {
  const user = await requirePermission("leads.manage");
  await assertLeadAccess(user, id);
  const type = str(f, "type") || "NOTE";
  if (!ACTIVITY_TYPES[type] || type === "STATUS") throw new Error("Noto'g'ri tur");
  const result = type === "CALL" ? optStr(f, "result") : null;
  const next = str(f, "nextActionAt");
  await db.leadActivity.create({ data: { leadId: id, userId: user.id, type, result, text: optStr(f, "text") } });
  const lead = await db.lead.findUniqueOrThrow({ where: { id } });
  const reached = type !== "NOTE" && !(type === "CALL" && result !== "ANSWERED");
  await db.lead.update({
    where: { id },
    data: {
      nextActionAt: next ? new Date(next) : null,
      // the first real contact moves a new lead forward automatically
      ...(lead.status === "NEW" && reached ? { status: "CONTACTED" } : {}),
    },
  });
  if (lead.status === "NEW" && reached) {
    await db.leadActivity.create({ data: { leadId: id, userId: user.id, type: "STATUS", result: "CONTACTED" } });
  }
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

export async function deleteLead(id: number) {
  const user = await requirePermission("leads.manage");
  await assertLeadAccess(user, id);
  const lead = await db.lead.delete({ where: { id } });
  await logAction(user, "lead.delete", `Lid o'chirildi: ${lead.name} (${lead.phone})`);
  revalidatePath("/leads");
}

/** Turns a lead into a student (optionally adding them to a group) and marks the lead as won. */
export async function convertLead(id: number, f: FormData) {
  const user = await requirePermission("leads.manage", "students.manage");
  await assertLeadAccess(user, id);
  const lead = await db.lead.findUniqueOrThrow({ where: { id } });
  const groupId = optId(f, "groupId");
  const student = await db.student.create({
    data: {
      name: lead.name,
      phone: lead.phone,
      note: lead.note,
      groups: groupId ? { create: { groupId } } : undefined,
    },
  });
  await db.lead.update({ where: { id }, data: { status: "WON", wonAt: new Date(), studentId: student.id, nextActionAt: null } });
  await db.leadActivity.create({ data: { leadId: id, userId: user.id, type: "STATUS", result: "WON" } });
  await logAction(user, "lead.convert", `Lid o'quvchiga aylantirildi: ${lead.name}`);
  revalidatePath("/leads");
  redirect(`/students/${student.id}`);
}

// ---------- Sales KPI ----------
export async function saveKpiTargets(userId: number, month: string, f: FormData) {
  const me = await requirePermission("sales.manage");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Noto'g'ri oy");
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const parts: string[] = [];
  for (const metric of Object.keys(KPI_METRICS)) {
    const target = num(f, `target_${metric}`);
    const key = { userId_month_metric: { userId, month, metric } };
    if (target <= 0) {
      await db.kpiTarget.deleteMany({ where: { userId, month, metric } });
      continue;
    }
    const data = { target, bonus: num(f, `bonus_${metric}`), perExtra: num(f, `extra_${metric}`) };
    await db.kpiTarget.upsert({ where: key, create: { userId, month, metric, ...data }, update: data });
    parts.push(`${KPI_METRICS[metric].label} ${target}`);
  }
  await logAction(me, "sales.kpi", `${u.name} KPI (${month}): ${parts.join(", ") || "o'chirildi"}`);
  revalidatePath("/sales");
  revalidatePath("/salaries");
}

/** Copies last month's KPI targets to this month for everyone who has none yet. */
export async function copyKpiFromPrevious(month: string) {
  const me = await requirePermission("sales.manage");
  const prev = shiftMonth(month, -1);
  const targets = await db.kpiTarget.findMany({ where: { month: prev } });
  let copied = 0;
  for (const t of targets) {
    const exists = await db.kpiTarget.count({ where: { userId: t.userId, month } });
    if (exists) continue;
    await db.kpiTarget.create({ data: { userId: t.userId, month, metric: t.metric, target: t.target, bonus: t.bonus, perExtra: t.perExtra } });
    copied++;
  }
  await logAction(me, "sales.kpi", `KPI ${prev} dan ${month} ga ko'chirildi (${copied} ta)`);
  revalidatePath("/sales");
}

// ---------- Students ----------
export async function createStudent(f: FormData) {
  const user = await requirePermission("students.manage");
  const groupId = optId(f, "groupId");
  if (groupId) await assertGroupAccess(user, groupId);
  const student = await db.student.create({
    data: {
      name: str(f, "name"),
      phone: str(f, "phone"),
      parentPhone: optStr(f, "parentPhone"),
      birthDate: day(f, "birthDate"),
      note: optStr(f, "note"),
      groups: groupId ? { create: { groupId } } : undefined,
    },
  });
  await logAction(user, "student.create", `Yangi o'quvchi: ${student.name}`);
  redirect(`/students/${student.id}`);
}

export async function updateStudent(id: number, f: FormData) {
  const user = await requirePermission("students.manage");
  await assertStudentAccess(user, id);
  await db.student.update({
    where: { id },
    data: {
      name: str(f, "name"),
      phone: str(f, "phone"),
      parentPhone: optStr(f, "parentPhone"),
      birthDate: day(f, "birthDate"),
      note: optStr(f, "note"),
    },
  });
  revalidatePath(`/students/${id}`);
}

export async function deleteStudent(id: number) {
  const user = await requirePermission("students.delete");
  const student = await db.student.delete({ where: { id } });
  await logAction(user, "student.delete", `O'quvchi o'chirildi: ${student.name} (${student.phone})`);
  redirect("/students");
}

export async function addStudentToGroup(f: FormData) {
  const user = await requirePermission("students.manage");
  const studentId = Number(str(f, "studentId"));
  const groupId = Number(str(f, "groupId"));
  await assertGroupAccess(user, groupId);
  const joinedAt = day(f, "joinedAt") ?? new Date();
  const gs = await db.groupStudent.upsert({
    where: { groupId_studentId: { groupId, studentId } },
    create: { groupId, studentId, joinedAt },
    update: { joinedAt, leftAt: null },
    include: { student: true, group: true },
  });
  await logAction(user, "student.join", `${gs.student.name} → ${gs.group.name} guruhiga qo'shildi`);
  revalidatePath(`/students/${studentId}`);
  revalidatePath(`/groups/${groupId}`);
}

export async function removeStudentFromGroup(groupId: number, studentId: number) {
  const user = await requirePermission("students.manage");
  await assertGroupAccess(user, groupId);
  const gs = await db.groupStudent.update({
    where: { groupId_studentId: { groupId, studentId } },
    data: { leftAt: new Date() },
    include: { student: true, group: true },
  });
  await logAction(user, "student.leave", `${gs.student.name} ${gs.group.name} guruhidan chiqarildi`);
  revalidatePath(`/students/${studentId}`);
  revalidatePath(`/groups/${groupId}`);
}

// ---------- Groups ----------
export async function createGroup(f: FormData) {
  const user = await requirePermission("groups.manage");
  const group = await db.group.create({
    data: {
      name: str(f, "name"),
      courseId: Number(str(f, "courseId")),
      teacherId: optId(f, "teacherId"),
      assistantId: optId(f, "assistantId"),
      roomId: optId(f, "roomId"),
      days: str(f, "days"),
      time: str(f, "time"),
      startDate: day(f, "startDate") ?? new Date(),
    },
  });
  await logAction(user, "group.create", `Yangi guruh: ${group.name}`);
  redirect(`/groups/${group.id}`);
}

export async function updateGroup(id: number, f: FormData) {
  const user = await requirePermission("groups.manage");
  await assertGroupAccess(user, id);
  const before = await db.group.findUniqueOrThrow({ where: { id } });
  const status = str(f, "status") || "ACTIVE";
  if (before.status !== "FINISHED" && status === "FINISHED") {
    // students graduate: stop monthly charges from today
    await db.groupStudent.updateMany({ where: { groupId: id, leftAt: null }, data: { leftAt: new Date() } });
    await logAction(user, "group.finish", `Guruh yakunlandi: ${before.name}`);
  }
  await db.group.update({
    where: { id },
    data: {
      name: str(f, "name"),
      courseId: Number(str(f, "courseId")),
      teacherId: optId(f, "teacherId"),
      assistantId: optId(f, "assistantId"),
      roomId: optId(f, "roomId"),
      days: str(f, "days"),
      time: str(f, "time"),
      status,
    },
  });
  revalidatePath(`/groups/${id}`);
}

export async function deleteGroup(id: number) {
  const user = await requirePermission("groups.delete");
  const group = await db.group.delete({ where: { id } });
  await logAction(user, "group.delete", `Guruh o'chirildi: ${group.name}`);
  redirect("/groups");
}

/** Cycles a student's attendance on a lesson: none → present → absent → none. */
export async function toggleAttendance(groupId: number, studentId: number, isoDay: string) {
  const user = await requirePermission("attendance.mark");
  await assertGroupAccess(user, groupId);
  const date = new Date(isoDay);
  const key = { groupId_studentId_date: { groupId, studentId, date } };
  const existing = await db.attendance.findUnique({ where: key });
  if (!existing) await db.attendance.create({ data: { groupId, studentId, date, present: true } });
  else if (existing.present) await db.attendance.update({ where: key, data: { present: false } });
  else await db.attendance.delete({ where: key });
  revalidatePath(`/groups/${groupId}`);
}

// ---------- Courses / rooms ----------
export async function createCourse(f: FormData) {
  await requirePermission("courses.manage");
  await db.course.create({
    data: {
      name: str(f, "name"),
      price: num(f, "price"),
      durationMon: num(f, "durationMon") || 6,
      lessonMin: num(f, "lessonMin") || 90,
      description: optStr(f, "description"),
    },
  });
  revalidatePath("/courses");
}

export async function updateCourse(id: number, f: FormData) {
  const user = await requirePermission("courses.manage");
  const before = await db.course.findUniqueOrThrow({ where: { id } });
  if (before.price !== num(f, "price")) {
    await logAction(user, "course.price", `${before.name} narxi: ${money(before.price)} → ${money(num(f, "price"))}`);
  }
  await db.course.update({
    where: { id },
    data: {
      name: str(f, "name"),
      price: num(f, "price"),
      durationMon: num(f, "durationMon") || 6,
      lessonMin: num(f, "lessonMin") || 90,
      description: optStr(f, "description"),
    },
  });
  revalidatePath("/courses");
}

export async function createRoom(f: FormData) {
  await requirePermission("rooms.manage");
  await db.room.create({ data: { name: str(f, "name"), capacity: num(f, "capacity") || 15 } });
  revalidatePath("/rooms");
}

export async function deleteRoom(id: number) {
  await requirePermission("rooms.manage");
  await db.group.updateMany({ where: { roomId: id }, data: { roomId: null } });
  await db.room.delete({ where: { id } });
  revalidatePath("/rooms");
}

// ---------- Staff ----------
export async function createUser(f: FormData) {
  const me = await requirePermission("staff.manage");
  const created = await db.user.create({
    data: {
      name: str(f, "name"),
      phone: str(f, "phone"),
      roleId: Number(str(f, "roleId")),
      isTeacher: f.get("isTeacher") === "on",
      isSales: f.get("isSales") === "on",
      password: await bcrypt.hash(str(f, "password"), 10),
    },
    include: { role: true },
  });
  await logAction(me, "staff.create", `Yangi xodim: ${created.name} (${created.role.name})`);
  revalidatePath("/teachers");
  revalidatePath("/settings");
}

export async function updateUser(id: number, f: FormData) {
  const me = await requirePermission("staff.manage");
  const roleId = Number(str(f, "roleId"));
  if (id === me.id) {
    // Changing your own role could lock you out of this page.
    const current = await db.user.findUniqueOrThrow({ where: { id } });
    if (current.roleId !== roleId) throw new Error("O'z rolingizni o'zgartira olmaysiz");
  } else {
    await assertNotLastAdmin(id, roleId);
  }
  const password = str(f, "password");
  const before = await db.user.findUniqueOrThrow({ where: { id }, include: { role: true } });
  const updated = await db.user.update({
    where: { id },
    data: {
      name: str(f, "name"),
      phone: str(f, "phone"),
      roleId,
      isTeacher: f.get("isTeacher") === "on",
      isSales: f.get("isSales") === "on",
      ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
    },
    include: { role: true },
  });
  if (before.roleId !== updated.roleId) {
    await logAction(me, "staff.role", `${updated.name}: rol ${before.role.name} → ${updated.role.name}`);
  }
  if (password) await logAction(me, "staff.password", `${updated.name} paroli o'zgartirildi`);
  revalidatePath("/settings");
  revalidatePath("/teachers");
}

export async function setUserActive(id: number, active: boolean) {
  const me = await requirePermission("staff.manage");
  if (id === me.id) throw new Error("O'zingizni bloklay olmaysiz");
  if (!active) await assertNotLastAdmin(id, null);
  const target = await db.user.update({ where: { id }, data: { active } });
  await logAction(me, active ? "staff.unblock" : "staff.block", `${target.name} ${active ? "faollashtirildi" : "bloklandi"}`);
  if (!active) await db.apiToken.deleteMany({ where: { userId: id } });
  revalidatePath("/settings");
}

/** Keeps at least one active administrator so nobody gets locked out. */
async function assertNotLastAdmin(userId: number, newRoleId: number | null) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { role: true } });
  if (!user.role.isSystem || !user.active) return;
  if (newRoleId === user.roleId) return;
  const admins = await db.user.count({ where: { active: true, role: { isSystem: true } } });
  if (admins <= 1) throw new Error("Kamida bitta faol administrator qolishi kerak");
}

// ---------- Roles ----------
function permissionsFrom(f: FormData) {
  return f.getAll("perm").map(String).filter((p) => ALL_PERMISSIONS.includes(p)).join(",");
}

export async function createRole(f: FormData) {
  const user = await requirePermission("staff.manage");
  const role = await db.role.create({ data: { name: str(f, "name"), permissions: permissionsFrom(f) } });
  await logAction(user, "role.create", `Yangi rol: ${role.name}`);
  revalidatePath("/settings/roles");
}

export async function updateRole(id: number, f: FormData) {
  const user = await requirePermission("staff.manage");
  const role = await db.role.findUniqueOrThrow({ where: { id } });
  if (role.isSystem) throw new ForbiddenError();
  const perms = permissionsFrom(f);
  await db.role.update({ where: { id }, data: { name: str(f, "name"), permissions: perms } });
  const was = new Set(role.permissions.split(",").filter(Boolean));
  const now = new Set(perms.split(",").filter(Boolean));
  const added = [...now].filter((p) => !was.has(p));
  const removed = [...was].filter((p) => !now.has(p));
  if (added.length || removed.length) {
    await logAction(user, "role.update", `"${role.name}" roli: ${[...added.map((p) => "+" + p), ...removed.map((p) => "−" + p)].join(", ")}`);
  }
  revalidatePath("/settings/roles");
}

export async function deleteRole(id: number) {
  const user = await requirePermission("staff.manage");
  const role = await db.role.findUniqueOrThrow({ where: { id }, include: { _count: { select: { users: true } } } });
  if (role.isSystem) throw new ForbiddenError();
  if (role._count.users > 0) throw new Error("Bu rolda xodimlar bor. Avval ularni boshqa rolga o'tkazing");
  await db.role.delete({ where: { id } });
  await logAction(user, "role.delete", `Rol o'chirildi: ${role.name}`);
  revalidatePath("/settings/roles");
}

// ---------- MCP tokens ----------
export type NewTokenState = { token: string } | null;

export async function createApiToken(_: NewTokenState, f: FormData): Promise<NewTokenState> {
  const user = await requirePermission("mcp.use");
  const token = `alg_${randomBytes(24).toString("base64url")}`;
  await db.apiToken.create({
    data: {
      name: str(f, "name") || "AI yordamchi",
      tokenHash: createHash("sha256").update(token).digest("hex"),
      prefix: token.slice(0, 8),
      userId: user.id,
    },
  });
  await logAction(user, "token.create", `MCP token yaratildi: ${str(f, "name") || "AI yordamchi"}`);
  revalidatePath("/settings/mcp");
  return { token };
}

export async function deleteApiToken(id: number) {
  const user = await requireUser();
  const token = await db.apiToken.findUniqueOrThrow({ where: { id } });
  if (token.userId !== user.id && !can(user, "staff.manage")) throw new ForbiddenError();
  await db.apiToken.delete({ where: { id } });
  await logAction(user, "token.delete", `MCP token bekor qilindi: ${token.name}`);
  revalidatePath("/settings/mcp");
}

// ---------- Money ----------
export async function createPayment(f: FormData) {
  const user = await requirePermission("payments.create");
  const studentId = Number(str(f, "studentId"));
  await assertStudentAccess(user, studentId);
  // Attribute the payment to the student's only active group when none was picked,
  // so per-group revenue and teacher percentage salaries stay accurate.
  let groupId = optId(f, "groupId");
  if (!groupId) {
    const active = await db.groupStudent.findMany({ where: { studentId, leftAt: null } });
    if (active.length === 1) groupId = active[0].groupId;
  }
  const payment = await db.payment.create({
    include: { student: true },
    data: {
      studentId,
      groupId,
      amount: num(f, "amount"),
      method: str(f, "method") || "CASH",
      note: optStr(f, "note"),
      date: day(f, "date") ?? new Date(),
    },
  });
  await logAction(user, "payment.create", `To'lov: ${payment.student.name} — ${money(payment.amount)}`);
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/payments");
}

export async function deletePayment(id: number) {
  const user = await requirePermission("payments.delete");
  const p = await db.payment.delete({ where: { id }, include: { student: true } });
  await logAction(user, "payment.delete", `To'lov o'chirildi: ${p.student.name} — ${money(p.amount)} (${p.date.toISOString().slice(0, 10)})`);
  revalidatePath(`/students/${p.studentId}`);
  revalidatePath("/payments");
}

export async function createExpense(f: FormData) {
  const user = await requirePermission("finance.manage");
  const e = await db.expense.create({
    data: { title: str(f, "title"), category: str(f, "category") || "OTHER", amount: num(f, "amount"), date: day(f, "date") ?? new Date() },
  });
  await logAction(user, "expense.create", `Xarajat: ${e.title} — ${money(e.amount)}`);
  revalidatePath("/finance");
}

export async function deleteExpense(id: number) {
  const user = await requirePermission("finance.manage");
  const e = await db.expense.findUniqueOrThrow({ where: { id }, include: { salaryPayment: true } });
  if (e.salaryPayment) throw new Error("Ish haqi xarajati Ish haqi bo'limidan o'chiriladi");
  await db.expense.delete({ where: { id } });
  await logAction(user, "expense.delete", `Xarajat o'chirildi: ${e.title} — ${money(e.amount)}`);
  revalidatePath("/finance");
}

// ---------- Grades & exams ----------
/** Sets (or clears, when score is empty) a student's 1–5 lesson grade for a date. */
export async function setGrade(groupId: number, studentId: number, isoDay: string, score: number | null) {
  const user = await requirePermission("grades.manage");
  await assertGroupAccess(user, groupId);
  const date = new Date(isoDay);
  const key = { groupId_studentId_date: { groupId, studentId, date } };
  if (score === null) {
    await db.grade.deleteMany({ where: { groupId, studentId, date } });
  } else {
    if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error("Baho 1 dan 5 gacha bo'lishi kerak");
    await db.grade.upsert({ where: key, create: { groupId, studentId, date, score }, update: { score } });
  }
  revalidatePath(`/groups/${groupId}`);
}

export async function createExam(groupId: number, f: FormData) {
  const user = await requirePermission("grades.manage");
  await assertGroupAccess(user, groupId);
  const maxScore = num(f, "maxScore") || 100;
  const scores = [...f.entries()]
    .filter(([k, v]) => k.startsWith("score_") && String(v).trim() !== "")
    .map(([k, v]) => ({ studentId: Number(k.slice(6)), score: Math.min(maxScore, Math.max(0, Number(v))) }));
  const exam = await db.exam.create({
    data: {
      groupId,
      title: str(f, "title"),
      date: day(f, "date") ?? new Date(),
      maxScore,
      results: { create: scores },
    },
    include: { group: true },
  });
  await logAction(user, "exam.create", `Imtihon: ${exam.group.name} — ${exam.title} (${scores.length} natija)`);
  revalidatePath(`/groups/${groupId}`);
}

export async function deleteExam(id: number) {
  const user = await requirePermission("grades.manage");
  const exam = await db.exam.findUniqueOrThrow({ where: { id }, include: { group: true } });
  await assertGroupAccess(user, exam.groupId);
  await db.exam.delete({ where: { id } });
  await logAction(user, "exam.delete", `Imtihon o'chirildi: ${exam.group.name} — ${exam.title}`);
  revalidatePath(`/groups/${exam.groupId}`);
}

// ---------- Salaries ----------
export async function updateSalaryRule(userId: number, f: FormData) {
  const me = await requirePermission("salaries.manage");
  const type = str(f, "salaryType");
  if (!SALARY_TYPES[type]) throw new Error("Noto'g'ri ish haqi turi");
  const amount = num(f, "salaryAmount");
  if (type === "PERCENT" && (amount < 0 || amount > 100)) throw new Error("Foiz 0–100 oralig'ida bo'lishi kerak");
  const u = await db.user.update({ where: { id: userId }, data: { salaryType: type, salaryAmount: type === "NONE" ? 0 : amount } });
  await logAction(me, "salary.rule", `${u.name} ish haqi qoidasi: ${SALARY_TYPES[type].label}${type === "NONE" ? "" : ` — ${amount} ${SALARY_TYPES[type].unit}`}`);
  revalidatePath("/salaries");
}

export async function paySalary(f: FormData) {
  const me = await requirePermission("salaries.manage");
  const userId = Number(str(f, "userId"));
  const month = str(f, "month");
  const amount = num(f, "amount");
  if (!/^\d{4}-\d{2}$/.test(month) || amount <= 0) throw new Error("Oy yoki summa noto'g'ri");
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const date = day(f, "date") ?? new Date();
  const expense = await db.expense.create({ data: { title: `Ish haqi — ${u.name} (${month})`, category: "SALARY", amount, date } });
  await db.salaryPayment.create({ data: { userId, month, amount, note: optStr(f, "note"), date, expenseId: expense.id } });
  await logAction(me, "salary.pay", `Ish haqi to'landi: ${u.name} — ${money(amount)} (${month})`);
  revalidatePath("/salaries");
  revalidatePath("/finance");
}

export async function deleteSalaryPayment(id: number) {
  const me = await requirePermission("salaries.manage");
  const p = await db.salaryPayment.findUniqueOrThrow({ where: { id }, include: { user: true } });
  await db.salaryPayment.delete({ where: { id } });
  if (p.expenseId) await db.expense.delete({ where: { id: p.expenseId } });
  await logAction(me, "salary.delete", `Ish haqi to'lovi bekor qilindi: ${p.user.name} — ${money(p.amount)} (${p.month})`);
  revalidatePath("/salaries");
  revalidatePath("/finance");
}

// ---------- Shop ----------
export async function saveProduct(id: number | null, f: FormData) {
  const user = await requirePermission("shop.manage");
  const data = {
    name: str(f, "name"),
    category: PRODUCT_CATEGORIES[str(f, "category")] ? str(f, "category") : "OTHER",
    price: num(f, "price"),
    cost: num(f, "cost"),
    active: id === null ? true : f.get("active") === "on",
  };
  if (!data.name || data.price <= 0) throw new Error("Nomi va narxi kerak");
  if (id === null) {
    const stock = num(f, "stock");
    const p = await db.product.create({ data: { ...data, stock } });
    if (stock > 0) await db.stockMove.create({ data: { productId: p.id, type: "IN", qty: stock, note: "Boshlang'ich qoldiq" } });
    await logAction(user, "shop.product", `Yangi mahsulot: ${p.name} — ${money(p.price)}`);
  } else {
    const before = await db.product.findUniqueOrThrow({ where: { id } });
    await db.product.update({ where: { id }, data });
    if (before.price !== data.price) await logAction(user, "shop.price", `${before.name} narxi: ${money(before.price)} → ${money(data.price)}`);
  }
  revalidatePath("/shop");
}

/** Adds stock (purchase). Optionally records the purchase as a GOODS expense. */
export async function restockProduct(id: number, f: FormData) {
  const user = await requirePermission("shop.manage");
  const qty = num(f, "qty");
  const unitCost = num(f, "cost");
  if (qty <= 0) throw new Error("Miqdor kerak");
  const p = await db.product.update({
    where: { id },
    data: { stock: { increment: qty }, ...(unitCost > 0 ? { cost: unitCost } : {}) },
  });
  await db.stockMove.create({ data: { productId: id, type: "IN", qty, note: optStr(f, "note") } });
  if (unitCost > 0 && f.get("asExpense") === "on") {
    await db.expense.create({ data: { title: `Tovar xaridi — ${p.name} × ${qty}`, category: "GOODS", amount: unitCost * qty } });
  }
  await logAction(user, "shop.restock", `Kirim: ${p.name} +${qty} (qoldiq ${p.stock})`);
  revalidatePath("/shop");
  revalidatePath("/finance");
}

/** Sets stock to the counted amount (inventory check). */
export async function adjustStock(id: number, f: FormData) {
  const user = await requirePermission("shop.manage");
  const counted = num(f, "counted");
  const p = await db.product.findUniqueOrThrow({ where: { id } });
  if (counted === p.stock) return;
  await db.product.update({ where: { id }, data: { stock: counted } });
  await db.stockMove.create({ data: { productId: id, type: "ADJUST", qty: counted - p.stock, note: optStr(f, "note") ?? "Inventarizatsiya" } });
  await logAction(user, "shop.adjust", `Inventarizatsiya: ${p.name} ${p.stock} → ${counted}`);
  revalidatePath("/shop");
}

export type SaleState = { error?: string; ok?: boolean } | null;

export async function createSale(_: SaleState, f: FormData): Promise<SaleState> {
  const user = await requirePermission("shop.sell");
  const wanted = [...f.entries()]
    .filter(([k]) => k.startsWith("qty_"))
    .map(([k, v]) => ({ productId: Number(k.slice(4)), qty: Math.floor(Number(v) || 0) }))
    .filter((x) => x.qty > 0);
  if (!wanted.length) return { error: "Kamida bitta mahsulot tanlang" };
  const products = await db.product.findMany({ where: { id: { in: wanted.map((w) => w.productId) }, active: true } });
  for (const w of wanted) {
    const p = products.find((x) => x.id === w.productId);
    if (!p) return { error: "Mahsulot topilmadi" };
    if (p.stock < w.qty) return { error: `${p.name}: omborda faqat ${p.stock} ta bor` };
  }
  const studentId = optId(f, "studentId");
  const items = wanted.map((w) => {
    const p = products.find((x) => x.id === w.productId)!;
    return { productId: p.id, qty: w.qty, price: p.price, cost: p.cost };
  });
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  let sale;
  try {
    sale = await db.$transaction(async (tx) => {
    // re-check stock inside the transaction so two cashiers can't oversell
    for (const i of items) {
      const res = await tx.product.updateMany({ where: { id: i.productId, stock: { gte: i.qty } }, data: { stock: { decrement: i.qty } } });
      if (res.count === 0) throw new Error("Omborda yetarli emas");
      await tx.stockMove.create({ data: { productId: i.productId, type: "OUT", qty: -i.qty } });
    }
    return tx.sale.create({
      data: { studentId, buyerName: studentId ? null : optStr(f, "buyerName"), userId: user.id, total, method: str(f, "method") || "CASH", items: { create: items } },
      include: { student: true },
    });
    });
  } catch {
    return { error: "Omborda yetarli mahsulot yo'q — sahifani yangilang" };
  }
  await logAction(user, "shop.sale", `Sotuv: ${sale.student?.name ?? sale.buyerName ?? "mijoz"} — ${money(total)} (${items.reduce((s, i) => s + i.qty, 0)} ta)`);
  revalidatePath("/shop");
  if (studentId) revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

export async function deleteSale(id: number) {
  const user = await requirePermission("shop.manage");
  const sale = await db.sale.findUniqueOrThrow({ where: { id }, include: { items: true, student: true } });
  await db.$transaction(async (tx) => {
    for (const i of sale.items) {
      await tx.product.update({ where: { id: i.productId }, data: { stock: { increment: i.qty } } });
      await tx.stockMove.create({ data: { productId: i.productId, type: "IN", qty: i.qty, note: `Sotuv #${id} bekor qilindi` } });
    }
    await tx.sale.delete({ where: { id } });
  });
  await logAction(user, "shop.sale_delete", `Sotuv bekor qilindi: ${sale.student?.name ?? sale.buyerName ?? "mijoz"} — ${money(sale.total)}`);
  revalidatePath("/shop");
}
