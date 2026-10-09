"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth";
import { assertGroupAccess, assertStudentAccess, can, ForbiddenError } from "@/lib/access";
import { ALL_PERMISSIONS } from "@/lib/permissions";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optStr = (f: FormData, k: string) => str(f, k) || null;
const num = (f: FormData, k: string) => Number(str(f, k).replace(/\s/g, "")) || 0;
const optId = (f: FormData, k: string) => (str(f, k) ? Number(str(f, k)) : null);
const day = (f: FormData, k: string) => (str(f, k) ? new Date(str(f, k)) : null);

// ---------- Leads ----------
export async function createLead(f: FormData) {
  await requirePermission("leads.manage");
  await db.lead.create({
    data: { name: str(f, "name"), phone: str(f, "phone"), source: optStr(f, "source"), courseId: optId(f, "courseId"), note: optStr(f, "note") },
  });
  revalidatePath("/leads");
}

export async function setLeadStatus(id: number, status: string) {
  await requirePermission("leads.manage");
  await db.lead.update({ where: { id }, data: { status } });
  revalidatePath("/leads");
}

export async function deleteLead(id: number) {
  await requirePermission("leads.manage");
  await db.lead.delete({ where: { id } });
  revalidatePath("/leads");
}

/** Turns a lead into a student (optionally adding them to a group) and marks the lead as won. */
export async function convertLead(id: number, f: FormData) {
  await requirePermission("leads.manage", "students.manage");
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
  await db.lead.update({ where: { id }, data: { status: "WON" } });
  revalidatePath("/leads");
  redirect(`/students/${student.id}`);
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
  await requirePermission("students.delete");
  await db.student.delete({ where: { id } });
  redirect("/students");
}

export async function addStudentToGroup(f: FormData) {
  const user = await requirePermission("students.manage");
  const studentId = Number(str(f, "studentId"));
  const groupId = Number(str(f, "groupId"));
  await assertGroupAccess(user, groupId);
  const joinedAt = day(f, "joinedAt") ?? new Date();
  await db.groupStudent.upsert({
    where: { groupId_studentId: { groupId, studentId } },
    create: { groupId, studentId, joinedAt },
    update: { joinedAt, leftAt: null },
  });
  revalidatePath(`/students/${studentId}`);
  revalidatePath(`/groups/${groupId}`);
}

export async function removeStudentFromGroup(groupId: number, studentId: number) {
  const user = await requirePermission("students.manage");
  await assertGroupAccess(user, groupId);
  await db.groupStudent.update({
    where: { groupId_studentId: { groupId, studentId } },
    data: { leftAt: new Date() },
  });
  revalidatePath(`/students/${studentId}`);
  revalidatePath(`/groups/${groupId}`);
}

// ---------- Groups ----------
export async function createGroup(f: FormData) {
  await requirePermission("groups.manage");
  const group = await db.group.create({
    data: {
      name: str(f, "name"),
      courseId: Number(str(f, "courseId")),
      teacherId: optId(f, "teacherId"),
      roomId: optId(f, "roomId"),
      days: str(f, "days"),
      time: str(f, "time"),
      startDate: day(f, "startDate") ?? new Date(),
    },
  });
  redirect(`/groups/${group.id}`);
}

export async function updateGroup(id: number, f: FormData) {
  const user = await requirePermission("groups.manage");
  await assertGroupAccess(user, id);
  await db.group.update({
    where: { id },
    data: {
      name: str(f, "name"),
      courseId: Number(str(f, "courseId")),
      teacherId: optId(f, "teacherId"),
      roomId: optId(f, "roomId"),
      days: str(f, "days"),
      time: str(f, "time"),
      status: str(f, "status") || "ACTIVE",
    },
  });
  revalidatePath(`/groups/${id}`);
}

export async function deleteGroup(id: number) {
  await requirePermission("groups.delete");
  await db.group.delete({ where: { id } });
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
  await requirePermission("courses.manage");
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
  await requirePermission("staff.manage");
  await db.user.create({
    data: {
      name: str(f, "name"),
      phone: str(f, "phone"),
      roleId: Number(str(f, "roleId")),
      isTeacher: f.get("isTeacher") === "on",
      password: await bcrypt.hash(str(f, "password"), 10),
    },
  });
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
  await db.user.update({
    where: { id },
    data: {
      name: str(f, "name"),
      phone: str(f, "phone"),
      roleId,
      isTeacher: f.get("isTeacher") === "on",
      ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
    },
  });
  revalidatePath("/settings");
  revalidatePath("/teachers");
}

export async function setUserActive(id: number, active: boolean) {
  const me = await requirePermission("staff.manage");
  if (id === me.id) throw new Error("O'zingizni bloklay olmaysiz");
  if (!active) await assertNotLastAdmin(id, null);
  await db.user.update({ where: { id }, data: { active } });
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
  await requirePermission("staff.manage");
  await db.role.create({ data: { name: str(f, "name"), permissions: permissionsFrom(f) } });
  revalidatePath("/settings/roles");
}

export async function updateRole(id: number, f: FormData) {
  await requirePermission("staff.manage");
  const role = await db.role.findUniqueOrThrow({ where: { id } });
  if (role.isSystem) throw new ForbiddenError();
  await db.role.update({ where: { id }, data: { name: str(f, "name"), permissions: permissionsFrom(f) } });
  revalidatePath("/settings/roles");
}

export async function deleteRole(id: number) {
  await requirePermission("staff.manage");
  const role = await db.role.findUniqueOrThrow({ where: { id }, include: { _count: { select: { users: true } } } });
  if (role.isSystem) throw new ForbiddenError();
  if (role._count.users > 0) throw new Error("Bu rolda xodimlar bor. Avval ularni boshqa rolga o'tkazing");
  await db.role.delete({ where: { id } });
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
  revalidatePath("/settings/mcp");
  return { token };
}

export async function deleteApiToken(id: number) {
  const user = await requireUser();
  const token = await db.apiToken.findUniqueOrThrow({ where: { id } });
  if (token.userId !== user.id && !can(user, "staff.manage")) throw new ForbiddenError();
  await db.apiToken.delete({ where: { id } });
  revalidatePath("/settings/mcp");
}

// ---------- Money ----------
export async function createPayment(f: FormData) {
  const user = await requirePermission("payments.create");
  const studentId = Number(str(f, "studentId"));
  await assertStudentAccess(user, studentId);
  await db.payment.create({
    data: {
      studentId,
      groupId: optId(f, "groupId"),
      amount: num(f, "amount"),
      method: str(f, "method") || "CASH",
      note: optStr(f, "note"),
      date: day(f, "date") ?? new Date(),
    },
  });
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/payments");
}

export async function deletePayment(id: number) {
  await requirePermission("payments.delete");
  const p = await db.payment.delete({ where: { id } });
  revalidatePath(`/students/${p.studentId}`);
  revalidatePath("/payments");
}

export async function createExpense(f: FormData) {
  await requirePermission("finance.manage");
  await db.expense.create({
    data: { title: str(f, "title"), category: str(f, "category") || "OTHER", amount: num(f, "amount"), date: day(f, "date") ?? new Date() },
  });
  revalidatePath("/finance");
}

export async function deleteExpense(id: number) {
  await requirePermission("finance.manage");
  await db.expense.delete({ where: { id } });
  revalidatePath("/finance");
}
