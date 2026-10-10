"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth";
import { assertGroupAccess, assertLeadAccess, assertStudentAccess, can, ForbiddenError } from "@/lib/access";
import { pickAssignee } from "@/lib/sales";
import { shiftMonth } from "@/lib/month";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { centreDay, recordEvent, startMembership } from "@/lib/membership-db";
import type { EventType } from "@/lib/membership";
import {
  ACTIVITY_TYPES, isoDate, CALL_RESULTS, EXPENSE_CATEGORIES, GROUP_DAYS, GROUP_LEVELS, KPI_METRICS, LEAD_STATUSES, money, PAYMENT_METHODS, PRODUCT_CATEGORIES,
} from "@/lib/format";
import { SALARY_TYPES } from "@/lib/salary";
import { check, parseForm, v } from "@/lib/validation";
import { phoneKey } from "@/lib/phone";

// ---------- Leads ----------
const leadSchema = z.object({
  name: v.text("Ism", 120),
  phone: v.text("Telefon", 40),
  source: v.optText(40),
  courseId: v.optId(),
  note: v.optText(),
  assignedToId: z.union([z.literal("auto"), v.optId()]),
});

export async function createLead(f: FormData) {
  const user = await requirePermission("leads.manage");
  const d = parseForm(leadSchema, f);
  // salespeople own the leads they add; others pick a salesperson or let the CRM choose
  const assignedToId = can(user, "leads.own") ? user.id : d.assignedToId === "auto" ? await pickAssignee() : d.assignedToId;
  const lead = await db.lead.create({
    data: { name: d.name, phone: d.phone, source: d.source, courseId: d.courseId, note: d.note, assignedToId, nextActionAt: new Date() },
  });
  await logAction(user, "lead.create", `Yangi lid: ${lead.name} (${lead.source ?? "manba yo'q"})`);
  revalidatePath("/leads");
}

// WON is set only by convertLead, which also creates the student.
const settableStatus = z.enum(LEAD_STATUSES.map((s) => s.key).filter((k) => k !== "WON") as [string, ...string[]], { error: "Noto'g'ri holat" });
const leadStatusSchema = z.object({ lostReason: v.optText(100), text: v.optText() });

/** Changes a lead's status and records it in the lead's history. LOST needs a reason. */
export async function setLeadStatus(id: number, status: string, f?: FormData) {
  const user = await requirePermission("leads.manage");
  await assertLeadAccess(user, id);
  const newStatus = check(settableStatus, status);
  const form = f ? parseForm(leadStatusSchema, f) : { lostReason: null, text: null };
  const lostReason = newStatus === "LOST" ? form.lostReason ?? "Boshqa" : null;
  const lead = await db.lead.update({
    where: { id },
    data: { status: newStatus, lostReason, ...(newStatus === "LOST" ? { nextActionAt: null } : {}) },
  });
  await db.leadActivity.create({
    data: { leadId: id, userId: user.id, type: "STATUS", result: newStatus, text: lostReason ?? form.text },
  });
  await logAction(user, "lead.status", `Lid "${lead.name}" holati: ${newStatus}${lostReason ? ` (${lostReason})` : ""}`);
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

export async function assignLead(id: number, f: FormData) {
  const user = await requirePermission("leads.manage");
  if (can(user, "leads.own")) throw new ForbiddenError();
  const { assignedToId } = parseForm(z.object({ assignedToId: v.optId() }), f);
  const lead = await db.lead.update({ where: { id }, data: { assignedToId }, include: { assignedTo: true } });
  await db.leadActivity.create({ data: { leadId: id, userId: user.id, type: "NOTE", text: `Biriktirildi: ${lead.assignedTo?.name ?? "hech kimga"}` } });
  await logAction(user, "lead.assign", `Lid "${lead.name}" → ${lead.assignedTo?.name ?? "biriktirilmagan"}`);
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

const leadActivitySchema = z.object({
  type: v.oneOf(ACTIVITY_TYPES, "NOTE").refine((t) => t !== "STATUS", "Noto'g'ri tur"),
  result: v.oneOf(CALL_RESULTS, null),
  text: v.optText(),
  nextActionAt: v.optDate(),
});

/** Logs a call / message / meeting / note and sets (or clears) the next follow-up. */
export async function addLeadActivity(id: number, f: FormData) {
  const user = await requirePermission("leads.manage");
  await assertLeadAccess(user, id);
  const d = parseForm(leadActivitySchema, f);
  const result = d.type === "CALL" ? d.result : null;
  await db.leadActivity.create({ data: { leadId: id, userId: user.id, type: d.type, result, text: d.text } });
  const lead = await db.lead.findUniqueOrThrow({ where: { id } });
  const reached = d.type !== "NOTE" && !(d.type === "CALL" && result !== "ANSWERED");
  await db.lead.update({
    where: { id },
    data: {
      nextActionAt: d.nextActionAt,
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
  const { groupId } = parseForm(z.object({ groupId: v.optId() }), f);
  const lead = await db.lead.findUniqueOrThrow({ where: { id } });
  const student = await db.student.create({
    data: {
      name: lead.name,
      phone: lead.phone,
      note: lead.note,
    },
  });
  if (groupId) await db.$transaction((tx) => startMembership(tx, { groupId, studentId: student.id, mode: "TRIAL", date: centreDay(), userId: user.id }));
  await db.lead.update({ where: { id }, data: { status: "WON", wonAt: new Date(), studentId: student.id, nextActionAt: null } });
  await db.leadActivity.create({ data: { leadId: id, userId: user.id, type: "STATUS", result: "WON" } });
  await logAction(user, "lead.convert", `Lid o'quvchiga aylantirildi: ${lead.name}`);
  revalidatePath("/leads");
  redirect(`/students/${student.id}`);
}

// ---------- Sales KPI ----------
const kpiSchema = z.object(
  Object.fromEntries(
    Object.keys(KPI_METRICS).flatMap((m) => [
      [`target_${m}`, v.int("Maqsad", { fallback: 0 })],
      [`bonus_${m}`, v.int("Bonus", { fallback: 0 })],
      [`extra_${m}`, v.int("Qo'shimcha bonus", { fallback: 0 })],
    ]),
  ),
);

export async function saveKpiTargets(userId: number, month: string, f: FormData) {
  const me = await requirePermission("sales.manage");
  check(v.month(), month);
  const d = parseForm(kpiSchema, f) as Record<string, number>;
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const parts: string[] = [];
  for (const metric of Object.keys(KPI_METRICS)) {
    const target = d[`target_${metric}`];
    const key = { userId_month_metric: { userId, month, metric } };
    if (target <= 0) {
      await db.kpiTarget.deleteMany({ where: { userId, month, metric } });
      continue;
    }
    const data = { target, bonus: d[`bonus_${metric}`], perExtra: d[`extra_${metric}`] };
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
  check(v.month(), month);
  const prev = shiftMonth(month, -1);
  const [targets, existing] = await Promise.all([
    db.kpiTarget.findMany({ where: { month: prev } }),
    db.kpiTarget.findMany({ where: { month }, select: { userId: true } }),
  ]);
  // decided per user before copying, so every metric of a user is copied, not just the first
  const alreadySet = new Set(existing.map((t) => t.userId));
  const toCopy = targets.filter((t) => !alreadySet.has(t.userId));
  await db.kpiTarget.createMany({
    data: toCopy.map((t) => ({ userId: t.userId, month, metric: t.metric, target: t.target, bonus: t.bonus, perExtra: t.perExtra })),
  });
  await logAction(me, "sales.kpi", `KPI ${prev} dan ${month} ga ko'chirildi (${toCopy.length} ta)`);
  revalidatePath("/sales");
}

// ---------- Students ----------
const studentSchema = z.object({
  name: v.text("Ism", 120),
  phone: v.text("Telefon", 40),
  parentPhone: v.optText(40),
  birthDate: v.optDate(),
  note: v.optText(),
});

export async function createStudent(f: FormData) {
  const user = await requirePermission("students.manage");
  const { groupId, ...data } = parseForm(studentSchema.extend({ groupId: v.optId() }), f);
  if (groupId) await assertGroupAccess(user, groupId);
  const student = await db.student.create({
    data,
  });
  if (groupId) await db.$transaction((tx) => startMembership(tx, { groupId, studentId: student.id, mode: "TRIAL", date: centreDay(), userId: user.id }));
  await logAction(user, "student.create", `Yangi o'quvchi: ${student.name}`);
  redirect(`/students/${student.id}`);
}

export async function updateStudent(id: number, f: FormData) {
  const user = await requirePermission("students.manage");
  await assertStudentAccess(user, id);
  await db.student.update({ where: { id }, data: parseForm(studentSchema, f) });
  revalidatePath(`/students/${id}`);
}

export async function deleteStudent(id: number) {
  const user = await requirePermission("students.delete");
  // Payments are financial history (revenue, teacher salaries): a student who has paid is
  // removed from their groups instead of being deleted. The schema enforces this too.
  if (await db.payment.count({ where: { studentId: id } })) {
    throw new Error("To'lovlari bor o'quvchini o'chirib bo'lmaydi. Uni guruhlardan chiqaring");
  }
  const student = await db.student.delete({ where: { id } });
  await logAction(user, "student.delete", `O'quvchi o'chirildi: ${student.name} (${student.phone})`);
  redirect("/students");
}

const MODES = { TRIAL: "Sinov darsi", ACTIVE: "Faol" };
const joinSchema = z.object({ studentId: v.id("O'quvchi"), groupId: v.id("Guruh"), joinedAt: v.optDate(), mode: v.oneOf(MODES, "TRIAL") });

export async function addStudentToGroup(f: FormData) {
  const user = await requirePermission("students.manage");
  const { studentId, groupId, joinedAt, mode } = parseForm(joinSchema, f);
  await assertGroupAccess(user, groupId);
  const date = joinedAt ?? centreDay();
  await db.$transaction((tx) => startMembership(tx, { groupId, studentId, mode: mode as "TRIAL" | "ACTIVE", date, userId: user.id }));
  const [student, group] = await Promise.all([db.student.findUniqueOrThrow({ where: { id: studentId } }), db.group.findUniqueOrThrow({ where: { id: groupId } })]);
  await logAction(user, "student.join", `${student.name} → ${group.name} (${MODES[mode as keyof typeof MODES].toLowerCase()}, ${isoDate(date)})`);
  revalidatePath(`/students/${studentId}`);
  revalidatePath(`/groups/${groupId}`);
}

/** Temporary: the old "Chiqarish" buttons (replaced by the member menu in the next step). */
export async function removeStudentFromGroup(groupId: number, studentId: number) {
  const user = await requirePermission("students.manage");
  await assertGroupAccess(user, groupId);
  const gs = await db.groupStudent.findUniqueOrThrow({ where: { groupId_studentId: { groupId, studentId } }, include: { student: true, group: true } });
  await db.$transaction((tx) => recordEvent(tx, gs.id, { type: "LEAVE", date: centreDay(), userId: user.id, system: true }));
  await logAction(user, "student.leave", `${gs.student.name} ${gs.group.name} guruhidan chiqarildi`);
  revalidatePath(`/students/${studentId}`);
  revalidatePath(`/groups/${groupId}`);
}

export type MemberActionState = { error?: string; ok?: boolean } | null;

const MEMBER_ACTIONS = { ACTIVATE: "faollashtirildi", FREEZE: "muzlatildi", UNFREEZE: "muzlatishdan chiqarildi", BACK_TO_TRIAL: "sinov darsiga qaytarildi", LEAVE: "guruhdan chiqarildi" };
const memberActionSchema = z.object({
  groupStudentId: v.id(),
  type: v.oneOf(MEMBER_ACTIONS),
  date: v.optDate(),
  reasonId: v.optId(),
  comment: v.optText(300),
});

/** Activate, freeze, unfreeze, return to trial or remove — one dialog, one action. */
export async function memberAction(_: MemberActionState, f: FormData): Promise<MemberActionState> {
  try {
    const user = await requirePermission("students.manage");
    const d = parseForm(memberActionSchema, f);
    const gs = await db.groupStudent.findUniqueOrThrow({ where: { id: d.groupStudentId }, include: { student: true, group: true } });
    await assertGroupAccess(user, gs.groupId);
    const date = d.date ?? centreDay();
    await db.$transaction((tx) => recordEvent(tx, gs.id, { type: d.type as EventType, date, reasonId: d.reasonId, comment: d.comment, userId: user.id }));
    const reason = d.reasonId ? (await db.reason.findUnique({ where: { id: d.reasonId } }))?.name : null;
    await logAction(user, `student.${d.type.toLowerCase()}`, `${gs.student.name} — ${gs.group.name}: ${MEMBER_ACTIONS[d.type as keyof typeof MEMBER_ACTIONS]} (${isoDate(date)}${reason ? `, ${reason}` : ""})`);
    revalidatePath(`/groups/${gs.groupId}`);
    revalidatePath(`/students/${gs.studentId}`);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const transferSchema = z.object({
  groupStudentId: v.id(),
  toGroupId: v.id("Yangi guruh"),
  date: v.optDate(),
  reasonId: v.optId(),
  mode: v.oneOf(MODES, "ACTIVE"),
});

/** Leaves the current group on a date and starts in another from the same date; the balance carries over. */
export async function transferStudent(_: MemberActionState, f: FormData): Promise<MemberActionState> {
  try {
    const user = await requirePermission("students.manage");
    const d = parseForm(transferSchema, f);
    const gs = await db.groupStudent.findUniqueOrThrow({ where: { id: d.groupStudentId }, include: { student: true, group: true } });
    if (gs.groupId === d.toGroupId) return { error: "O'quvchi allaqachon shu guruhda" };
    await assertGroupAccess(user, gs.groupId);
    await assertGroupAccess(user, d.toGroupId);
    const date = d.date ?? centreDay();
    const to = await db.group.findUniqueOrThrow({ where: { id: d.toGroupId } });
    await db.$transaction(async (tx) => {
      await recordEvent(tx, gs.id, { type: "LEAVE", date, reasonId: d.reasonId, comment: `${to.name} guruhiga o'tkazildi`, userId: user.id });
      await startMembership(tx, { groupId: d.toGroupId, studentId: gs.studentId, mode: d.mode as "TRIAL" | "ACTIVE", date, userId: user.id });
    });
    await logAction(user, "student.transfer", `${gs.student.name}: ${gs.group.name} → ${to.name} (${isoDate(date)})`);
    revalidatePath(`/groups/${gs.groupId}`);
    revalidatePath(`/groups/${d.toGroupId}`);
    revalidatePath(`/students/${gs.studentId}`);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------- Groups ----------
const GROUP_STATUSES = { ACTIVE: "Faol", FINISHED: "Tugagan" };

const groupSchema = z.object({
  name: v.text("Guruh nomi", 80),
  level: v.oneOf(GROUP_LEVELS, null),
  courseId: v.id("Kurs"),
  teacherId: v.optId(),
  assistantId: v.optId(),
  roomId: v.optId(),
  days: v.oneOf(GROUP_DAYS),
  time: v.time(),
});

export async function createGroup(f: FormData) {
  const user = await requirePermission("groups.manage");
  const { startDate, ...data } = parseForm(groupSchema.extend({ startDate: v.optDate() }), f);
  const group = await db.group.create({ data: { ...data, startDate: startDate ?? new Date() } });
  await logAction(user, "group.create", `Yangi guruh: ${group.name}`);
  redirect(`/groups/${group.id}`);
}

export async function updateGroup(id: number, f: FormData) {
  const user = await requirePermission("groups.manage");
  await assertGroupAccess(user, id);
  const data = parseForm(groupSchema.extend({ status: v.oneOf(GROUP_STATUSES, "ACTIVE") }), f);
  const before = await db.group.findUniqueOrThrow({ where: { id } });
  if (before.status !== "FINISHED" && data.status === "FINISHED") {
    // students graduate: charges stop today for everyone still in the group (trial and frozen too)
    const members = await db.groupStudent.findMany({ where: { groupId: id, status: { not: "LEFT" } } });
    await db.$transaction(async (tx) => {
      for (const m of members) await recordEvent(tx, m.id, { type: "LEAVE", date: centreDay(), userId: user.id, system: true, comment: "Guruh yakunlandi" });
    });
    await logAction(user, "group.finish", `Guruh yakunlandi: ${before.name}`);
  }
  await db.group.update({ where: { id }, data });
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
  const date = check(v.isoDay(), isoDay);
  const key = { groupId_studentId_date: { groupId, studentId, date } };
  const existing = await db.attendance.findUnique({ where: key });
  if (!existing) await db.attendance.create({ data: { groupId, studentId, date, present: true } });
  else if (existing.present) await db.attendance.update({ where: key, data: { present: false } });
  else await db.attendance.delete({ where: key });
  revalidatePath(`/groups/${groupId}`);
}

// ---------- Courses / rooms ----------
const courseSchema = z.object({
  name: v.text("Kurs nomi", 120),
  price: v.int("Narx"),
  durationMon: v.int("Davomiylik (oy)", { min: 1, max: 120, fallback: 6 }),
  lessonMin: v.int("Dars davomiyligi (daqiqa)", { min: 10, max: 600, fallback: 90 }),
  description: v.optText(2000),
});

export async function createCourse(f: FormData) {
  await requirePermission("courses.manage");
  await db.course.create({ data: parseForm(courseSchema, f) });
  revalidatePath("/courses");
}

export async function updateCourse(id: number, f: FormData) {
  const user = await requirePermission("courses.manage");
  const data = parseForm(courseSchema, f);
  const before = await db.course.findUniqueOrThrow({ where: { id } });
  if (before.price !== data.price) {
    await logAction(user, "course.price", `${before.name} narxi: ${money(before.price)} → ${money(data.price)}`);
  }
  await db.course.update({ where: { id }, data });
  revalidatePath("/courses");
}

const roomSchema = z.object({ name: v.text("Xona nomi", 60), capacity: v.int("Sig'im", { min: 1, max: 1000, fallback: 15 }) });

export async function createRoom(f: FormData) {
  await requirePermission("rooms.manage");
  await db.room.create({ data: parseForm(roomSchema, f) });
  revalidatePath("/rooms");
}

export async function deleteRoom(id: number) {
  await requirePermission("rooms.manage");
  await db.group.updateMany({ where: { roomId: id }, data: { roomId: null } });
  await db.room.delete({ where: { id } });
  revalidatePath("/rooms");
}

// ---------- Staff ----------
const staffSchema = z.object({
  name: v.text("Ism", 120),
  phone: v.text("Telefon", 40).refine((p) => phoneKey(p).length >= 9, "Telefon raqam noto'g'ri (9 ta raqam kerak, masalan 901234567)"),
  roleId: v.id("Rol"),
  isTeacher: v.checkbox(),
  isSales: v.checkbox(),
  password: v.password(),
});

/** Login matches phones by digits, so two staff can't share a number written differently. */
async function assertPhoneFree(phone: string, exceptUserId?: number) {
  const key = phoneKey(phone);
  const users = await db.user.findMany({ where: exceptUserId ? { id: { not: exceptUserId } } : {}, select: { phone: true, name: true } });
  const taken = users.find((u) => phoneKey(u.phone) === key);
  if (taken) throw new Error(`Bu telefon raqam allaqachon ${taken.name} uchun ishlatilgan`);
}

export async function createUser(f: FormData) {
  const me = await requirePermission("staff.manage");
  const { password, ...data } = parseForm(staffSchema, f);
  await assertPhoneFree(data.phone);
  const created = await db.user.create({
    data: { ...data, password: await bcrypt.hash(password, 10) },
    include: { role: true },
  });
  await logAction(me, "staff.create", `Yangi xodim: ${created.name} (${created.role.name})`);
  revalidatePath("/teachers");
  revalidatePath("/settings");
}

export async function updateUser(id: number, f: FormData) {
  const me = await requirePermission("staff.manage");
  // leaving the password blank keeps the current one
  const { password, ...data } = parseForm(staffSchema.extend({ password: v.optPassword() }), f);
  await assertPhoneFree(data.phone, id);
  if (id === me.id) {
    // Changing your own role could lock you out of this page.
    const current = await db.user.findUniqueOrThrow({ where: { id } });
    if (current.roleId !== data.roleId) throw new Error("O'z rolingizni o'zgartira olmaysiz");
  } else {
    await assertNotLastAdmin(id, data.roleId);
  }
  const before = await db.user.findUniqueOrThrow({ where: { id }, include: { role: true } });
  const updated = await db.user.update({
    where: { id },
    data: { ...data, ...(password ? { password: await bcrypt.hash(password, 10) } : {}) },
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
  check(z.boolean(), active);
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
const roleSchema = z.object({ name: v.text("Rol nomi", 60) });

function permissionsFrom(f: FormData) {
  return f.getAll("perm").map(String).filter((p) => ALL_PERMISSIONS.includes(p)).join(",");
}

export async function createRole(f: FormData) {
  const user = await requirePermission("staff.manage");
  const { name } = parseForm(roleSchema, f);
  const role = await db.role.create({ data: { name, permissions: permissionsFrom(f) } });
  await logAction(user, "role.create", `Yangi rol: ${role.name}`);
  revalidatePath("/settings/roles");
}

export async function updateRole(id: number, f: FormData) {
  const user = await requirePermission("staff.manage");
  const { name } = parseForm(roleSchema, f);
  const role = await db.role.findUniqueOrThrow({ where: { id } });
  if (role.isSystem) throw new ForbiddenError();
  const perms = permissionsFrom(f);
  await db.role.update({ where: { id }, data: { name, permissions: perms } });
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
  const name = parseForm(z.object({ name: v.optText(60) }), f).name ?? "AI yordamchi";
  const token = `alg_${randomBytes(24).toString("base64url")}`;
  await db.apiToken.create({
    data: {
      name,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      prefix: token.slice(0, 8),
      userId: user.id,
    },
  });
  await logAction(user, "token.create", `MCP token yaratildi: ${name}`);
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
const paymentSchema = z.object({
  studentId: v.id("O'quvchi"),
  groupId: v.optId(),
  amount: v.int("Summa", { min: 1 }),
  method: v.oneOf(PAYMENT_METHODS, "CASH"),
  note: v.optText(500),
  date: v.optDate(),
});

export async function createPayment(f: FormData) {
  const user = await requirePermission("payments.create");
  const d = parseForm(paymentSchema, f);
  await assertStudentAccess(user, d.studentId);
  // Attribute the payment to the student's only active group when none was picked,
  // so per-group revenue and teacher percentage salaries stay accurate.
  let groupId = d.groupId;
  if (!groupId) {
    const active = await db.groupStudent.findMany({ where: { studentId: d.studentId, leftAt: null } });
    if (active.length === 1) groupId = active[0].groupId;
  }
  const payment = await db.payment.create({
    include: { student: true },
    data: { studentId: d.studentId, groupId, amount: d.amount, method: d.method, note: d.note, date: d.date ?? new Date() },
  });
  await logAction(user, "payment.create", `To'lov: ${payment.student.name} — ${money(payment.amount)}`);
  revalidatePath(`/students/${d.studentId}`);
  revalidatePath("/payments");
}

export async function deletePayment(id: number) {
  const user = await requirePermission("payments.delete");
  const p = await db.payment.delete({ where: { id }, include: { student: true } });
  await logAction(user, "payment.delete", `To'lov o'chirildi: ${p.student.name} — ${money(p.amount)} (${p.date.toISOString().slice(0, 10)})`);
  revalidatePath(`/students/${p.studentId}`);
  revalidatePath("/payments");
}

const expenseSchema = z.object({
  title: v.text("Xarajat nomi", 200),
  category: v.oneOf(EXPENSE_CATEGORIES, "OTHER"),
  amount: v.int("Summa", { min: 1 }),
  date: v.optDate(),
});

export async function createExpense(f: FormData) {
  const user = await requirePermission("finance.manage");
  const { date, ...data } = parseForm(expenseSchema, f);
  const e = await db.expense.create({ data: { ...data, date: date ?? new Date() } });
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
const gradeScore = z.number().int().min(1, "Baho 1 dan 5 gacha bo'lishi kerak").max(5, "Baho 1 dan 5 gacha bo'lishi kerak").nullable();

/** Sets (or clears, when score is empty) a student's 1–5 lesson grade for a date. */
export async function setGrade(groupId: number, studentId: number, isoDay: string, score: number | null) {
  const user = await requirePermission("grades.manage");
  await assertGroupAccess(user, groupId);
  const date = check(v.isoDay(), isoDay);
  const value = check(gradeScore, score);
  const key = { groupId_studentId_date: { groupId, studentId, date } };
  if (value === null) {
    await db.grade.deleteMany({ where: { groupId, studentId, date } });
  } else {
    await db.grade.upsert({ where: key, create: { groupId, studentId, date, score: value }, update: { score: value } });
  }
  revalidatePath(`/groups/${groupId}`);
}

const examSchema = z.object({
  title: v.text("Imtihon nomi", 200),
  date: v.optDate(),
  maxScore: v.int("Maksimal ball", { min: 1, max: 10_000, fallback: 100 }),
});

export async function createExam(groupId: number, f: FormData) {
  const user = await requirePermission("grades.manage");
  await assertGroupAccess(user, groupId);
  const { title, date, maxScore } = parseForm(examSchema, f);
  const score = v.int("Ball", { min: 0, max: maxScore });
  const scores = [...f.entries()]
    .filter(([k, val]) => k.startsWith("score_") && String(val).trim() !== "")
    .map(([k, val]) => ({ studentId: check(v.id("O'quvchi"), k.slice(6)), score: check(score, val) }));
  const exam = await db.exam.create({
    data: { groupId, title, date: date ?? new Date(), maxScore, results: { create: scores } },
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
const salaryRuleSchema = z
  .object({ salaryType: v.oneOf(SALARY_TYPES), salaryAmount: v.int("Summa", { fallback: 0 }) })
  .refine((d) => d.salaryType !== "PERCENT" || d.salaryAmount <= 100, "Foiz 0–100 oralig'ida bo'lishi kerak");

export async function updateSalaryRule(userId: number, f: FormData) {
  const me = await requirePermission("salaries.manage");
  const { salaryType: type, salaryAmount: amount } = parseForm(salaryRuleSchema, f);
  const u = await db.user.update({ where: { id: userId }, data: { salaryType: type, salaryAmount: type === "NONE" ? 0 : amount } });
  await logAction(me, "salary.rule", `${u.name} ish haqi qoidasi: ${SALARY_TYPES[type].label}${type === "NONE" ? "" : ` — ${amount} ${SALARY_TYPES[type].unit}`}`);
  revalidatePath("/salaries");
}

const salaryPaymentSchema = z.object({
  userId: v.id("Xodim"),
  month: v.month(),
  amount: v.int("Summa", { min: 1 }),
  date: v.optDate(),
  note: v.optText(500),
});

export async function paySalary(f: FormData) {
  const me = await requirePermission("salaries.manage");
  const { userId, month, amount, date: picked, note } = parseForm(salaryPaymentSchema, f);
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const date = picked ?? new Date();
  const expense = await db.expense.create({ data: { title: `Ish haqi — ${u.name} (${month})`, category: "SALARY", amount, date } });
  await db.salaryPayment.create({ data: { userId, month, amount, note, date, expenseId: expense.id } });
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
const productSchema = z.object({
  name: v.text("Mahsulot nomi", 120),
  category: v.oneOf(PRODUCT_CATEGORIES, "OTHER"),
  price: v.int("Narx", { min: 1 }),
  cost: v.int("Tannarx", { fallback: 0 }),
  active: v.checkbox(),
  stock: v.int("Boshlang'ich qoldiq", { fallback: 0 }),
});

export async function saveProduct(id: number | null, f: FormData) {
  const user = await requirePermission("shop.manage");
  const { stock, ...form } = parseForm(productSchema, f);
  const data = { ...form, active: id === null ? true : form.active };
  if (id === null) {
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

const restockSchema = z.object({
  qty: v.int("Miqdor", { min: 1 }),
  cost: v.int("Tannarx", { fallback: 0 }),
  note: v.optText(500),
  asExpense: v.checkbox(),
});

/** Adds stock (purchase). Optionally records the purchase as a GOODS expense. */
export async function restockProduct(id: number, f: FormData) {
  const user = await requirePermission("shop.manage");
  const { qty, cost: unitCost, note, asExpense } = parseForm(restockSchema, f);
  const p = await db.product.update({
    where: { id },
    data: { stock: { increment: qty }, ...(unitCost > 0 ? { cost: unitCost } : {}) },
  });
  await db.stockMove.create({ data: { productId: id, type: "IN", qty, note } });
  if (unitCost > 0 && asExpense) {
    await db.expense.create({ data: { title: `Tovar xaridi — ${p.name} × ${qty}`, category: "GOODS", amount: unitCost * qty } });
  }
  await logAction(user, "shop.restock", `Kirim: ${p.name} +${qty} (qoldiq ${p.stock})`);
  revalidatePath("/shop");
  revalidatePath("/finance");
}

const adjustSchema = z.object({ counted: v.int("Sanalgan miqdor"), note: v.optText(500) });

/** Sets stock to the counted amount (inventory check). */
export async function adjustStock(id: number, f: FormData) {
  const user = await requirePermission("shop.manage");
  const { counted, note } = parseForm(adjustSchema, f);
  const p = await db.product.findUniqueOrThrow({ where: { id } });
  if (counted === p.stock) return;
  await db.product.update({ where: { id }, data: { stock: counted } });
  await db.stockMove.create({ data: { productId: id, type: "ADJUST", qty: counted - p.stock, note: note ?? "Inventarizatsiya" } });
  await logAction(user, "shop.adjust", `Inventarizatsiya: ${p.name} ${p.stock} → ${counted}`);
  revalidatePath("/shop");
}

export type SaleState = { error?: string; ok?: boolean } | null;

const saleSchema = z.object({ studentId: v.optId(), buyerName: v.optText(120), method: v.oneOf(PAYMENT_METHODS, "CASH") });
const saleQty = v.int("Miqdor", { fallback: 0 });

export async function createSale(_: SaleState, f: FormData): Promise<SaleState> {
  const user = await requirePermission("shop.sell");
  let form: z.output<typeof saleSchema>;
  let wanted: { productId: number; qty: number }[];
  try {
    form = parseForm(saleSchema, f);
    wanted = [...f.entries()]
      .filter(([k]) => k.startsWith("qty_"))
      .map(([k, val]) => ({ productId: check(v.id("Mahsulot"), k.slice(4)), qty: check(saleQty, val) }))
      .filter((x) => x.qty > 0);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!wanted.length) return { error: "Kamida bitta mahsulot tanlang" };
  const products = await db.product.findMany({ where: { id: { in: wanted.map((w) => w.productId) }, active: true } });
  for (const w of wanted) {
    const p = products.find((x) => x.id === w.productId);
    if (!p) return { error: "Mahsulot topilmadi" };
    if (p.stock < w.qty) return { error: `${p.name}: omborda faqat ${p.stock} ta bor` };
  }
  const { studentId, buyerName, method } = form;
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
      data: { studentId, buyerName: studentId ? null : buyerName, userId: user.id, total, method, items: { create: items } },
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
