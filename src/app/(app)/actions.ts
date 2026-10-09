"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, requireSession } from "@/lib/auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optStr = (f: FormData, k: string) => str(f, k) || null;
const num = (f: FormData, k: string) => Number(str(f, k).replace(/\s/g, "")) || 0;
const optId = (f: FormData, k: string) => (str(f, k) ? Number(str(f, k)) : null);
const day = (f: FormData, k: string) => (str(f, k) ? new Date(str(f, k)) : null);

// ---------- Leads ----------
export async function createLead(f: FormData) {
  await requireSession();
  await db.lead.create({
    data: { name: str(f, "name"), phone: str(f, "phone"), source: optStr(f, "source"), courseId: optId(f, "courseId"), note: optStr(f, "note") },
  });
  revalidatePath("/leads");
}

export async function setLeadStatus(id: number, status: string) {
  await requireSession();
  await db.lead.update({ where: { id }, data: { status } });
  revalidatePath("/leads");
}

export async function deleteLead(id: number) {
  await requireSession();
  await db.lead.delete({ where: { id } });
  revalidatePath("/leads");
}

/** Turns a lead into a student (optionally adding them to a group) and marks the lead as won. */
export async function convertLead(id: number, f: FormData) {
  await requireSession();
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
  await requireSession();
  const groupId = optId(f, "groupId");
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
  await requireSession();
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
  await requireAdmin();
  await db.student.delete({ where: { id } });
  redirect("/students");
}

export async function addStudentToGroup(f: FormData) {
  await requireSession();
  const studentId = Number(str(f, "studentId"));
  const groupId = Number(str(f, "groupId"));
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
  await requireSession();
  await db.groupStudent.update({
    where: { groupId_studentId: { groupId, studentId } },
    data: { leftAt: new Date() },
  });
  revalidatePath(`/students/${studentId}`);
  revalidatePath(`/groups/${groupId}`);
}

// ---------- Groups ----------
export async function createGroup(f: FormData) {
  await requireSession();
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
  await requireSession();
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
  await requireAdmin();
  await db.group.delete({ where: { id } });
  redirect("/groups");
}

/** Cycles a student's attendance on a lesson: none → present → absent → none. */
export async function toggleAttendance(groupId: number, studentId: number, isoDay: string) {
  await requireSession();
  const date = new Date(isoDay);
  const key = { groupId_studentId_date: { groupId, studentId, date } };
  const existing = await db.attendance.findUnique({ where: key });
  if (!existing) await db.attendance.create({ data: { groupId, studentId, date, present: true } });
  else if (existing.present) await db.attendance.update({ where: key, data: { present: false } });
  else await db.attendance.delete({ where: key });
  revalidatePath(`/groups/${groupId}`);
}

// ---------- Courses / rooms / teachers ----------
export async function createCourse(f: FormData) {
  await requireSession();
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
  await requireSession();
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
  await requireSession();
  await db.room.create({ data: { name: str(f, "name"), capacity: num(f, "capacity") || 15 } });
  revalidatePath("/rooms");
}

export async function deleteRoom(id: number) {
  await requireAdmin();
  await db.group.updateMany({ where: { roomId: id }, data: { roomId: null } });
  await db.room.delete({ where: { id } });
  revalidatePath("/rooms");
}

export async function createUser(f: FormData) {
  await requireAdmin();
  await db.user.create({
    data: {
      name: str(f, "name"),
      phone: str(f, "phone"),
      role: str(f, "role") || "TEACHER",
      password: await bcrypt.hash(str(f, "password"), 10),
    },
  });
  revalidatePath("/teachers");
  revalidatePath("/settings");
}

export async function deleteUser(id: number) {
  const session = await requireAdmin();
  if (session.userId === id) return;
  await db.group.updateMany({ where: { teacherId: id }, data: { teacherId: null } });
  await db.user.delete({ where: { id } });
  revalidatePath("/teachers");
  revalidatePath("/settings");
}

// ---------- Money ----------
export async function createPayment(f: FormData) {
  await requireSession();
  const studentId = Number(str(f, "studentId"));
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
  await requireAdmin();
  const p = await db.payment.delete({ where: { id } });
  revalidatePath(`/students/${p.studentId}`);
  revalidatePath("/payments");
}

export async function createExpense(f: FormData) {
  await requireSession();
  await db.expense.create({
    data: { title: str(f, "title"), category: str(f, "category") || "OTHER", amount: num(f, "amount"), date: day(f, "date") ?? new Date() },
  });
  revalidatePath("/finance");
}

export async function deleteExpense(id: number) {
  await requireAdmin();
  await db.expense.delete({ where: { id } });
  revalidatePath("/finance");
}
