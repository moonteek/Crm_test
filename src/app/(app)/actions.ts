"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { notify } from "@/lib/telegram-bot";
import { telegramClient } from "@/lib/telegram-client";
import { cancelText, makeupTexts, makeupUndoText, restoreText, salaryText, substituteTexts, substituteUndoText, type Outgoing } from "@/lib/telegram-plan";
import { teacherOn } from "@/lib/teachers-history";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth";
import { assertGroupAccess, assertLeadAccess, assertStudentAccess, can, ForbiddenError } from "@/lib/access";
import { pickAssignee } from "@/lib/sales";
import { shiftMonth } from "@/lib/month";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { centreDay, recordEvent, startMembership } from "@/lib/membership-db";
import { nextMonthStart, schedulePrice } from "@/lib/prices-db";
import { editedGroupPrice } from "@/lib/prices";
import { changeTeacher } from "@/lib/teachers-db";
import { menuActions, statusOn, systemLeaveDate, transferPlan, type EventType, type Status } from "@/lib/membership";
import {
  ACTIVITY_TYPES, isoDate, CALL_RESULTS, lessonWeekdays, MONTHS, EXPENSE_CATEGORIES, GENDERS, GROUP_DAYS, GROUP_LEVELS, KPI_METRICS, LEAD_SOURCES, LEAD_STATUSES, money, PAYMENT_METHODS, PRODUCT_CATEGORIES, TAG_COLORS,
} from "@/lib/format";
import { SALARY_TYPES } from "@/lib/salary";
import { levelExams } from "@/lib/curriculum";
import { levelExamToSave } from "@/lib/group-exams";
import { assertLessonOpen, closedDaysOf, holidayDays, makeupDaysOf } from "@/lib/holidays-db";
import { clashesOn, lessonChangeOpen, lessonOpenOn, makeupEditProblem, makeupOffRecipients, lessonChangeProblem, makeupLocked, makeupProblem } from "@/lib/lesson-changes";
import { canDeleteHoliday, expandRange, holidayProblem } from "@/lib/holidays";
import { canDelete, canEnd, discountProblem, lastMonth } from "@/lib/discounts";
import { editDiff } from "@/lib/payments";
import { fillPresent, MARK_KEYS, markWrite, type MarkKey } from "@/lib/attendance";
import { COURSE_COLORS } from "@/lib/timetable";
import { logoProblem, RECEIPT_LINES, type ReceiptLine } from "@/lib/receipt";
import { getReceiptSettings, saveReceiptSettings } from "@/lib/receipt-db";
import { teacherFormSchema } from "@/lib/teacher-profile";
import { imageProblem } from "@/lib/image";
import { busyMarkMessages, clashMessage, DAY_END, DAY_START, DAY_TYPE_LABEL, DAY_TYPES, fitsDay, groupClashes, needsClashCheck, teacherGrid, type DayType, type LessonLike } from "@/lib/availability";
import { check, parseForm, v } from "@/lib/validation";
import { errorText, tryAction, type ActionState } from "@/lib/action-result";
import { structureProblem, type LineShape } from "@/lib/curriculum-convert";
import { emailField, telegramField } from "@/lib/student-contacts";
import { decodeDocument, documentProblem } from "@/lib/documents";
import { assertMarkAccess } from "@/lib/cover-db";
import { CONTACT_RESULTS, riskSettingsSchema } from "@/lib/risk";
import { storeRiskSettings } from "@/lib/risk-db";
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

export async function createLead(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("leads.manage");
    const d = parseForm(leadSchema, f);
    // salespeople own the leads they add; others pick a salesperson or let the CRM choose
    const assignedToId = can(user, "leads.own") ? user.id : d.assignedToId === "auto" ? await pickAssignee() : d.assignedToId;
    const lead = await db.lead.create({
      data: { name: d.name, phone: d.phone, source: d.source, courseId: d.courseId, note: d.note, assignedToId, nextActionAt: new Date() },
    });
    await logAction(user, "lead.create", `Yangi lid: ${lead.name} (${lead.source ?? "manba yo'q"})`);
    revalidatePath("/leads");
  });
}

// WON is set only by convertLead, which also creates the student.
const settableStatus = z.enum(LEAD_STATUSES.map((s) => s.key).filter((k) => k !== "WON") as [string, ...string[]], { error: "Noto'g'ri holat" });
const leadStatusSchema = z.object({ lostReason: v.optText(100), text: v.optText() });

/** Changes a lead's status and records it in the lead's history. LOST needs a reason. */
export async function setLeadStatus(id: number, status: string, _?: ActionState, f?: FormData): Promise<ActionState> {
  return tryAction(async () => {
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
  });
}

export async function assignLead(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("leads.manage");
    if (can(user, "leads.own")) throw new ForbiddenError();
    const { assignedToId } = parseForm(z.object({ assignedToId: v.optId() }), f);
    const lead = await db.lead.update({ where: { id }, data: { assignedToId }, include: { assignedTo: true } });
    await db.leadActivity.create({ data: { leadId: id, userId: user.id, type: "NOTE", text: `Biriktirildi: ${lead.assignedTo?.name ?? "hech kimga"}` } });
    await logAction(user, "lead.assign", `Lid "${lead.name}" → ${lead.assignedTo?.name ?? "biriktirilmagan"}`);
    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
  });
}

const leadActivitySchema = z.object({
  type: v.oneOf(ACTIVITY_TYPES, "NOTE").refine((t) => t !== "STATUS", "Noto'g'ri tur"),
  result: v.oneOf(CALL_RESULTS, null),
  text: v.optText(),
  nextActionAt: v.optDate(),
});

/** Logs a call / message / meeting / note and sets (or clears) the next follow-up. */
export async function addLeadActivity(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
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
  });
}

export async function deleteLead(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("leads.manage");
    await assertLeadAccess(user, id);
    const lead = await db.lead.delete({ where: { id } });
    await logAction(user, "lead.delete", `Lid o'chirildi: ${lead.name} (${lead.phone})`);
    revalidatePath("/leads");
  });
}

/** Turns a lead into a student (optionally adding them to a group) and marks the lead as won. */
export async function convertLead(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("leads.manage", "students.manage");
    await assertLeadAccess(user, id);
    const { groupId } = parseForm(z.object({ groupId: v.optId() }), f);
    const lead = await db.lead.findUniqueOrThrow({ where: { id } });
    // all or nothing: a refused group start must not leave a student behind (the form stays open for another try)
    const student = await db.$transaction(async (tx) => {
      const s = await tx.student.create({
        data: {
          name: lead.name,
          phone: lead.phone,
          note: lead.note,
          source: lead.source,
        },
      });
      if (groupId) await startMembership(tx, { groupId, studentId: s.id, mode: "TRIAL", date: centreDay(), userId: user.id });
      await tx.lead.update({ where: { id }, data: { status: "WON", wonAt: new Date(), studentId: s.id, nextActionAt: null } });
      await tx.leadActivity.create({ data: { leadId: id, userId: user.id, type: "STATUS", result: "WON" } });
      return s;
    });
    await logAction(user, "lead.convert", `Lid o'quvchiga aylantirildi: ${lead.name}`, { studentId: student.id });
    revalidatePath("/leads");
    redirect(`/students/${student.id}`);
  });
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

export async function saveKpiTargets(userId: number, month: string, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
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
  });
}

/** Copies last month's KPI targets to this month for everyone who has none yet. */
export async function copyKpiFromPrevious(month: string): Promise<ActionState> {
  return tryAction(async () => {
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
  });
}

// ---------- Students ----------
const studentSchema = z.object({
  name: v.text("Ism", 120),
  phone: v.text("Telefon", 40),
  birthDate: v.optDate(),
  fatherName: v.optText(120),
  fatherPhone: v.optText(40),
  motherName: v.optText(120),
  motherPhone: v.optText(40),
  // the round icons: Telegram, email, extra phone, passport
  telegram: telegramField,
  email: emailField,
  phone2: v.optText(40),
  // "+ qo'shimcha ma'lumot"
  gender: v.oneOf(GENDERS, null),
  school: v.optText(120),
  address: v.optText(200),
  source: v.oneOf(LEAD_SOURCES, null),
  passport: v.optText(40),
});

/** How a student starts in a group: free trial or charged from the given date. */
const MODES = { TRIAL: "Sinov darsi", ACTIVE: "Faol" };

export async function createStudent(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("students.manage");
    const { groupId, mode, joinedAt, ...data } = parseForm(studentSchema.extend({ groupId: v.optId(), mode: v.oneOf(MODES, "TRIAL"), joinedAt: v.optDate() }), f);
    if (groupId) await assertGroupAccess(user, groupId);
    // tags chosen in the add form (staff who manage tags); switched-off tags are ignored
    const wanted = can(user, "students.tags") ? f.getAll("tagId").map((x) => check(v.id("Teg"), x)) : [];
    const tagIds = wanted.length ? (await db.tag.findMany({ where: { id: { in: wanted }, active: true }, select: { id: true } })).map((t) => t.id) : [];
    // all or nothing: a refused group start must not leave a student behind (the form stays open for another try)
    const student = await db.$transaction(async (tx) => {
      const s = await tx.student.create({ data: { ...data, tags: { create: tagIds.map((tagId) => ({ tagId })) } } });
      if (groupId) await startMembership(tx, { groupId, studentId: s.id, mode: mode as "TRIAL" | "ACTIVE", date: joinedAt ?? centreDay(), userId: user.id });
      return s;
    });
    await logAction(user, "student.create", `Yangi o'quvchi: ${student.name}`, { studentId: student.id });
    redirect(`/students/${student.id}`);
  });
}

export async function updateStudent(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("students.manage");
    await assertStudentAccess(user, id);
    const student = await db.student.update({ where: { id }, data: parseForm(studentSchema, f) });
    await logAction(user, "student.update", `Ma'lumotlari tahrirlandi: ${student.name}`, { studentId: id });
    revalidatePath(`/students/${id}`);
  });
}

export async function deleteStudent(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("students.delete");
    // Payments are financial history (revenue, teacher salaries): a student who has paid is
    // removed from their groups instead of being deleted. The schema enforces this too.
    if (await db.payment.count({ where: { studentId: id } })) {
      throw new Error("To'lovlari bor o'quvchini o'chirib bo'lmaydi. Uni guruhlardan chiqaring");
    }
    const student = await db.student.delete({ where: { id } });
    await logAction(user, "student.delete", `O'quvchi o'chirildi: ${student.name} (${student.phone})`);
    redirect("/students");
  });
}

const joinSchema = z.object({ studentId: v.id("O'quvchi"), groupId: v.id("Guruh"), joinedAt: v.optDate(), mode: v.oneOf(MODES, "TRIAL") });

export async function addStudentToGroup(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("students.manage");
    const { studentId, groupId, joinedAt, mode } = parseForm(joinSchema, f);
    await assertGroupAccess(user, groupId);
    const date = joinedAt ?? centreDay();
    await db.$transaction((tx) => startMembership(tx, { groupId, studentId, mode: mode as "TRIAL" | "ACTIVE", date, userId: user.id }));
    const [student, group] = await Promise.all([db.student.findUniqueOrThrow({ where: { id: studentId } }), db.group.findUniqueOrThrow({ where: { id: groupId } })]);
    await logAction(user, "student.join", `${student.name} → ${group.name} (${MODES[mode as keyof typeof MODES].toLowerCase()}, ${isoDate(date)})`, { studentId });
    revalidatePath(`/students/${studentId}`);
    revalidatePath(`/groups/${groupId}`);
  });
}

export type MemberActionState = ActionState;

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
    if (!menuActions(gs.status as Status).includes(d.type as EventType)) {
      return { error: gs.status === "LEFT" ? "O'quvchi bu guruhdan chiqqan — qayta qo'shish uchun \"Guruhga qo'shish\"dan foydalaning" : "Bu amalni bajarib bo'lmaydi" };
    }
    const date = d.date ?? centreDay();
    await db.$transaction((tx) => recordEvent(tx, gs.id, { type: d.type as EventType, date, reasonId: d.reasonId, comment: d.comment, userId: user.id }));
    const reason = d.reasonId ? (await db.reason.findUnique({ where: { id: d.reasonId } }))?.name : null;
    await logAction(user, `student.${d.type.toLowerCase()}`, `${gs.student.name} — ${gs.group.name}: ${MEMBER_ACTIONS[d.type as keyof typeof MEMBER_ACTIONS]} (${isoDate(date)}${reason ? `, ${reason}` : ""})`, { studentId: gs.studentId });
    revalidatePath(`/groups/${gs.groupId}`);
    revalidatePath(`/students/${gs.studentId}`);
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
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
    // "Guruhda saqlab qolish": join the new group and stay in the old one
    const keep = f.get("keep") === "on";
    const steps = transferPlan(keep);
    await db.$transaction(async (tx) => {
      if (steps.includes("LEAVE_OLD")) await recordEvent(tx, gs.id, { type: "LEAVE", date, reasonId: d.reasonId, comment: `${to.name} guruhiga o'tkazildi`, userId: user.id });
      await startMembership(tx, { groupId: d.toGroupId, studentId: gs.studentId, mode: d.mode as "TRIAL" | "ACTIVE", date, userId: user.id });
    });
    await logAction(user, "student.transfer", keep
      ? `${gs.student.name}: ${to.name} guruhiga qo'shildi (${gs.group.name} da qoldi, ${isoDate(date)})`
      : `${gs.student.name}: ${gs.group.name} → ${to.name} (${isoDate(date)})`, { studentId: gs.studentId });
    revalidatePath(`/groups/${gs.groupId}`);
    revalidatePath(`/groups/${d.toGroupId}`);
    revalidatePath(`/students/${gs.studentId}`);
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
  }
}

// ---------- Groups ----------
const GROUP_STATUSES = { ACTIVE: "Faol", FINISHED: "Tugagan" };

const groupSchema = z.object({
  name: v.text("Guruh nomi", 80),
  level: v.oneOf(GROUP_LEVELS, null),
  price: v.optInt("Guruh narxi", { min: 1 }),
  startSubjectId: v.optId(),
  startLevel: v.int("Boshlanish darajasi", { min: 1, max: 24, fallback: 1 }),
  courseId: v.id("Kurs"),
  sectionId: v.optId(),
  teacherId: v.optId(),
  assistantId: v.optId(),
  roomId: v.optId(),
  days: v.oneOf(GROUP_DAYS),
  time: v.time(),
});

/** The section the group studies: one of its course's (empty = the course's first section). */
async function groupSection(courseId: number, sectionId: number | null) {
  const section = sectionId
    ? await db.section.findUnique({ where: { id: sectionId } })
    : await db.section.findFirst({ where: { courseId }, orderBy: { position: "asc" } });
  if (sectionId && section?.courseId !== courseId) throw new Error("Bo'lim bu kursga tegishli emas");
  return section;
}

/** Keeps the start point inside the chosen section: another section's line or a level past its levels falls back. */
async function startPoint(sectionId: number | null, startSubjectId: number | null, startLevel: number) {
  if (!sectionId) return { startSubjectId: null, startLevel: 1 };
  const line = startSubjectId ? await db.subject.findFirst({ where: { id: startSubjectId, sectionId } }) : null;
  const first = await db.subject.findFirst({ where: { sectionId }, orderBy: { position: "asc" } });
  // the section's beginning is stored as "no start point", so reordering or deleting lines can't move the group
  if (!line || (line.id === first?.id && startLevel <= 1)) return { startSubjectId: null, startLevel: 1 };
  return { startSubjectId: line.id, startLevel: Math.min(startLevel, line.levels) };
}

type GroupTime = { id?: number; name: string; days: string; time: string; courseId: number; teacherId: number | null; assistantId: number | null; roomId: number | null };

/**
 * A group's lesson must fit 08:00–20:00 and not collide with another active group's teacher, assistant or room
 * (throws one message listing every problem). Hours the teacher marked "band" only come back as warnings.
 */
async function checkGroupTime(g: GroupTime): Promise<{ warnings: string[] }> {
  const course = await db.course.findUniqueOrThrow({ where: { id: g.courseId } });
  const candidate: LessonLike = { ...g, minutes: course.lessonMin };
  if (!fitsDay(g.time, course.lessonMin)) throw new Error("Dars 08:00–20:00 oralig'ida bo'lishi kerak");
  const [others, users, rooms] = await Promise.all([
    db.group.findMany({ where: { status: "ACTIVE" }, include: { course: { select: { lessonMin: true } } } }),
    db.user.findMany({ select: { id: true, name: true } }),
    db.room.findMany({ select: { id: true, name: true } }),
  ]);
  const names = { users: new Map(users.map((u) => [u.id, u.name])), rooms: new Map(rooms.map((r) => [r.id, r.name])) };
  const clashes = groupClashes(candidate, others.map((o) => ({ ...o, minutes: o.course.lessonMin })), names);
  if (clashes.length) throw new Error(clashes.map(clashMessage).join("; "));
  const ids = [g.teacherId, g.assistantId].filter((x): x is number => x !== null);
  const slots = ids.length ? await db.teacherSlot.findMany({ where: { userId: { in: ids } } }) : [];
  return { warnings: busyMarkMessages(candidate, slots, names.users) };
}

async function insertGroup(f: FormData) {
  const user = await requirePermission("groups.manage");
  const { startDate, ...data } = parseForm(groupSchema.extend({ startDate: v.optDate() }), f);
  const { warnings } = await checkGroupTime(data);
  const section = await groupSection(data.courseId, data.sectionId);
  // a new group takes its section's price when it has one (else it follows the course price)
  const price = data.price ?? section?.price ?? null;
  const group = await db.group.create({
    data: { ...data, price, sectionId: section?.id ?? null, ...(await startPoint(section?.id ?? null, data.startSubjectId, data.startLevel)), startDate: startDate ?? new Date() },
  });
  await logAction(user, "group.create", `Yangi guruh: ${group.name}`);
  // only a flag in the link: the group page works the warning out itself, so a link can't show made-up text
  return `/groups/${group.id}${warnings.length ? "?warn=1" : ""}`;
}

/** The new-group dialog: shows why a group can't be opened (time, clashes) instead of closing. */
export async function saveNewGroup(_: MemberActionState, f: FormData): Promise<MemberActionState> {
  let to: string;
  try {
    to = await insertGroup(f);
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
  }
  redirect(to);
}

export async function updateGroup(id: number, f: FormData) {
  const user = await requirePermission("groups.manage");
  await assertGroupAccess(user, id);
  const { teacherFrom, ...data } = parseForm(groupSchema.extend({ status: v.oneOf(GROUP_STATUSES, "ACTIVE"), teacherFrom: v.optDate() }), f);
  const before = await db.group.findUniqueOrThrow({ where: { id }, include: { course: true, teacher: true, assistant: true } });
  // a changed lesson time / teacher / room must not collide with another group (a finished group has no lessons)
  const { warnings } = data.status === "ACTIVE" && (before.status !== "ACTIVE" || needsClashCheck(before, data)) ? await checkGroupTime({ ...data, id }) : { warnings: [] };
  // a new teacher / assistant takes over from the chosen day; earlier lessons stay with the previous person
  const from = teacherFrom ?? centreDay();
  // a new price (own, or the new course's) starts next month; past months keep what they were charged
  const section = await groupSection(data.courseId, data.sectionId);
  // level exams are numbered within the section: once one is scored the group stays in its section
  if (data.courseId === before.courseId && (section?.id ?? null) !== before.sectionId) {
    const scored = await db.exam.findFirst({ where: { groupId: id, level: { not: null }, results: { some: {} } }, select: { id: true } });
    if (scored) throw new Error("Guruhda daraja imtihoni baholangan — bo'limni o'zgartirib bo'lmaydi");
  }
  const coursePrice = (await db.course.findUniqueOrThrow({ where: { id: data.courseId } })).price;
  const { own, target } = editedGroupPrice({ formPrice: data.price, sectionChanged: (section?.id ?? null) !== before.sectionId, sectionPrice: section?.price ?? null, coursePrice });
  const current = before.price ?? before.course.price;
  const start = await startPoint(section?.id ?? null, data.startSubjectId, data.startLevel);
  const changes: string[] = [];
  // teacher history, price history and the group are saved together: all or nothing
  const repriced = await db.$transaction(async (tx) => {
    if (data.teacherId !== before.teacherId) {
      await changeTeacher(tx, id, "TEACHER", before.teacherId, data.teacherId, from);
      changes.push("o'qituvchi");
    }
    if (data.assistantId !== before.assistantId) {
      await changeTeacher(tx, id, "ASSISTANT", before.assistantId, data.assistantId, from);
      changes.push("yordamchi");
    }
    // saved level exams are numbered within the old course's section: keep them as ordinary exams
    if (data.courseId !== before.courseId) await tx.exam.updateMany({ where: { groupId: id, level: { not: null } }, data: { level: null } });
    const priced = await schedulePrice(tx, id, target, current, user.id);
    await tx.group.update({ where: { id }, data: { ...data, price: own, sectionId: section?.id ?? null, ...start } });
    return priced;
  });
  if (changes.length) await logAction(user, "group.teacher", `${before.name}: ${changes.join(" va ")} ${isoDate(from)} dan almashtirildi`);
  if (repriced) await logAction(user, "group.price", `${before.name} narxi ${isoDate(nextMonthStart())} dan: ${money(target)}`);
  if (before.status !== "FINISHED" && data.status === "FINISHED") {
    // students graduate: charges stop today for everyone still in the group (trial and frozen too)
    const members = await db.groupStudent.findMany({ where: { groupId: id, status: { not: "LEFT" } }, include: { events: { orderBy: [{ date: "asc" }, { id: "asc" }] } } });
    await db.$transaction(async (tx) => {
      for (const m of members) {
        await recordEvent(tx, m.id, { type: "LEAVE", date: systemLeaveDate(m.events, centreDay()), userId: user.id, system: true, comment: "Guruh yakunlandi" });
      }
    });
    await logAction(user, "group.finish", `Guruh yakunlandi: ${before.name}`);
  }
  revalidatePath(`/groups/${id}`);
  return { warnings };
}

/** The group edit dialog: same as updateGroup, but returns the refusal reason to show in the dialog. */
export async function saveGroup(_: MemberActionState, f: FormData): Promise<MemberActionState> {
  try {
    const { warnings } = await updateGroup(check(v.id(), f.get("groupId")), f);
    return { ok: true, warning: warnings.join("; ") || undefined };
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
  }
}

/** Brings an archived (finished) group back to active. Its students stay as they are — re-add them by hand. */
export async function restoreGroup(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("groups.manage");
    await assertGroupAccess(user, id);
    const group = await db.group.update({ where: { id }, data: { status: "ACTIVE" } });
    await logAction(user, "group.restore", `Guruh arxivdan qaytarildi: ${group.name}`);
    revalidatePath("/groups");
    revalidatePath(`/groups/${id}`);
  });
}

export async function deleteGroup(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("groups.delete");
    const group = await db.group.delete({ where: { id } });
    await logAction(user, "group.delete", `Guruh o'chirildi: ${group.name}`);
    redirect("/groups");
  });
}

/** Cycles a student's attendance on a lesson: none → present → absent → none. */
/** The grid cell popover: keldi / kechikdi / kelmadi, or null to clear the mark ("Tozalash"). */
export async function setAttendance(groupId: number, studentId: number, isoDay: string, mark: MarkKey | null): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("attendance.mark");
    const date = check(v.isoDay(), isoDay);
    await assertMarkAccess(user, groupId, isoDate(date));
    const key = mark === null ? null : check(z.enum(MARK_KEYS), mark);
    await assertLessonOpen(groupId, date);
    if (!(await db.groupStudent.findFirst({ where: { groupId, studentId } }))) throw new Error("O'quvchi bu guruhda emas");
    const where = { groupId_studentId_date: { groupId, studentId, date } };
    if (key === null) await db.attendance.deleteMany({ where: { groupId, studentId, date } });
    else {
      const value = markWrite(key);
      await db.attendance.upsert({ where, create: { groupId, studentId, date, ...value }, update: value });
    }
    revalidatePath(`/groups/${groupId}`);
  });
}

/** Today's lesson for the group (or a refusal): one of its lesson days or a make-up day, not a holiday or cancelled. */
async function lessonOf(groupId: number, date: Date) {
  const group = await db.group.findUniqueOrThrow({ where: { id: groupId } });
  const open = lessonOpenOn(isoDate(date), { noLesson: [], extra: (await makeupDaysOf())(groupId), weekdayLesson: lessonWeekdays(group.days).includes(date.getUTCDay()) });
  if (!open) throw new Error("Bu kunda guruhda dars yo'q");
  await assertLessonOpen(groupId, date);
  return { group, date };
}
const todayLessonOf = (groupId: number) => lessonOf(groupId, centreDay());


/** "Bugungi dars": one tap sets today's mark for a student (keldi / kechikdi / kelmadi). */
export async function markToday(groupId: number, studentId: number, mark: MarkKey): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("attendance.mark");
    await assertMarkAccess(user, groupId, isoDate(centreDay()));
    const { date } = await todayLessonOf(groupId);
    const value = markWrite(check(z.enum(MARK_KEYS), mark));
    if (!(await db.groupStudent.findFirst({ where: { groupId, studentId, leftAt: null } }))) throw new Error("O'quvchi bu guruhda emas");
    await db.attendance.upsert({
      where: { groupId_studentId_date: { groupId, studentId, date } },
      create: { groupId, studentId, date, ...value },
      update: value,
    });
    revalidatePath(`/groups/${groupId}`);
  });
}

/** "Hammasi keldi": everyone not marked yet today (and not frozen) becomes present; given marks are kept. */
export async function markAllPresent(groupId: number, isoDay?: string): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("attendance.mark");
    const day = isoDay ? check(v.isoDay(), isoDay) : centreDay();
    await assertMarkAccess(user, groupId, isoDate(day));
    const { group, date } = await lessonOf(groupId, day);
    const [all, marked] = await Promise.all([
      db.groupStudent.findMany({ where: { groupId }, select: { studentId: true, status: true, leftAt: true, events: { select: { type: true, date: true }, orderBy: [{ date: "asc" }, { id: "asc" }] } } }),
      db.attendance.findMany({ where: { groupId, date } }),
    ]);
    // only students who were in the group (active or on trial) on that day — the date may be in the past
    // (a membership without history yet falls back to its current status)
    const members = all.filter((m) => ["ACTIVE", "TRIAL"].includes((m.events.length ? statusOn(m.events as { type: EventType; date: Date }[], date) : m.leftAt ? null : m.status) ?? ""));
    const todo = fillPresent(members.map((m) => m.studentId), new Map(marked.map((a) => [a.studentId, { present: a.present, late: a.late }])));
    if (todo.length) await db.attendance.createMany({ data: todo.map((studentId) => ({ groupId, studentId, date, present: true })) });
    await logAction(user, "group.attendance", `Davomat: ${group.name} — hammasi keldi (${todo.length} ta)`);
    revalidatePath(`/groups/${groupId}`);
  });
}

// ---------- Courses / rooms ----------
const courseSchema = z.object({
  name: v.text("Kurs nomi", 120),
  price: v.int("Narx"),
  durationMon: v.int("Davomiylik (oy)", { min: 1, max: 600, fallback: 6 }),
  lessonMin: v.int("Dars davomiyligi (daqiqa)", { min: 10, max: 600, fallback: 120 }),
  description: v.optText(2000),
  passPercent: v.int("O'tish bali", { min: 1, max: 100, fallback: 60 }),
  // timetable colour; empty = picked automatically
  color: v.oneOf(COURSE_COLORS, null),
});

/** The course picture field: "" keeps the stored one, "remove" clears it, else a new PNG/JPG data URL. */
function courseImage(f: FormData): { image?: string | null } {
  const upload = String(f.get("image") ?? "");
  if (!upload) return {};
  if (upload === "remove") return { image: null };
  const problem = imageProblem(upload, "Rasm");
  if (problem) throw new Error(problem);
  return { image: upload };
}

export async function createCourse(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    await requirePermission("courses.manage");
    const data = parseForm(courseSchema, f);
    // every course starts with one section named after it (more can be added in "Bo'limlar va darajalar")
    await db.course.create({ data: { ...data, ...courseImage(f), sections: { create: { name: data.name.slice(0, 60), position: 1 } } } });
    revalidatePath("/courses");
  });
}

export async function updateCourse(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("courses.manage");
    const data = parseForm(courseSchema, f);
    const before = await db.course.findUniqueOrThrow({ where: { id } });
    if (before.price !== data.price) {
      // groups that follow the course price get the new price from next month; groups with their own price don't
      const following = await db.group.findMany({ where: { courseId: id, price: null } });
      await db.$transaction(async (tx) => {
        for (const g of following) {
          await schedulePrice(tx, g.id, data.price, before.price, user.id);
        }
      });
      await logAction(user, "course.price", `${before.name} narxi ${isoDate(nextMonthStart())} dan: ${money(before.price)} → ${money(data.price)}`);
    }
    await db.course.update({ where: { id }, data: { ...data, ...courseImage(f) } });
    revalidatePath("/courses");
  });
}

const roomSchema = z.object({ name: v.text("Xona nomi", 60), capacity: v.int("Sig'im", { min: 1, max: 1000, fallback: 15 }) });

export async function createRoom(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    await requirePermission("rooms.manage");
    await db.room.create({ data: parseForm(roomSchema, f) });
    revalidatePath("/rooms");
  });
}

export async function deleteRoom(id: number): Promise<ActionState> {
  return tryAction(async () => {
    await requirePermission("rooms.manage");
    await db.group.updateMany({ where: { roomId: id }, data: { roomId: null } });
    await db.room.delete({ where: { id } });
    revalidatePath("/rooms");
  });
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

export async function createUser(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
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
  });
}

export async function updateUser(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
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
  });
}

export async function setUserActive(id: number, active: boolean): Promise<ActionState> {
  return tryAction(async () => {
    const me = await requirePermission("staff.manage");
    check(z.boolean(), active);
    if (id === me.id) throw new Error("O'zingizni bloklay olmaysiz");
    if (!active) await assertNotLastAdmin(id, null);
    const target = await db.user.update({ where: { id }, data: { active } });
    await logAction(me, active ? "staff.unblock" : "staff.block", `${target.name} ${active ? "faollashtirildi" : "bloklandi"}`);
    if (!active) await db.apiToken.deleteMany({ where: { userId: id } });
    revalidatePath("/settings");
  });
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

export async function createRole(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("staff.manage");
    const { name } = parseForm(roleSchema, f);
    const role = await db.role.create({ data: { name, permissions: permissionsFrom(f) } });
    await logAction(user, "role.create", `Yangi rol: ${role.name}`);
    revalidatePath("/settings/roles");
  });
}

export async function updateRole(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
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
  });
}

export async function deleteRole(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("staff.manage");
    const role = await db.role.findUniqueOrThrow({ where: { id }, include: { _count: { select: { users: true } } } });
    if (role.isSystem) throw new ForbiddenError();
    if (role._count.users > 0) throw new Error("Bu rolda xodimlar bor. Avval ularni boshqa rolga o'tkazing");
    await db.role.delete({ where: { id } });
    await logAction(user, "role.delete", `Rol o'chirildi: ${role.name}`);
    revalidatePath("/settings/roles");
  });
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

export async function deleteApiToken(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requireUser();
    const token = await db.apiToken.findUniqueOrThrow({ where: { id } });
    if (token.userId !== user.id && !can(user, "staff.manage")) throw new ForbiddenError();
    await db.apiToken.delete({ where: { id } });
    await logAction(user, "token.delete", `MCP token bekor qilindi: ${token.name}`);
    revalidatePath("/settings/mcp");
  });
}

// ---------- Money ----------
const paymentSchema = z.object({
  studentId: v.id("O'quvchi"),
  groupId: v.optId(),
  amount: v.int("Summa", { min: 1 }),
  method: v.oneOf(PAYMENT_METHODS, "CASH"),
  note: v.optText(500),
  date: v.optDate(),
  month: z.preprocess((x) => (typeof x === "string" && /^\d{4}-\d{2}$/.test(x) ? new Date(`${x}-01T00:00:00Z`) : null), z.date().nullable()),
});

/** The payment dialog's result: the new payment (for "Chek chiqarish"), or why it wasn't saved. */
export type PaymentState = { error?: string; paymentId?: number; amount?: number } | null;

export async function createPayment(_: PaymentState, f: FormData): Promise<PaymentState> {
  try {
    return await takePayment(f);
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
  }
}

async function takePayment(f: FormData): Promise<PaymentState> {
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
    data: { studentId: d.studentId, groupId, amount: d.amount, method: d.method, note: d.note, date: d.date ?? new Date(), month: d.month, userId: user.id },
  });
  await logAction(user, "payment.create", `To'lov: ${payment.student.name} — ${money(payment.amount)}`, { studentId: payment.studentId });
  revalidatePath(`/students/${d.studentId}`);
  revalidatePath("/payments");
  return { paymentId: payment.id, amount: payment.amount };
}

const snapshot = (p: { amount: number; method: string; date: Date; month: Date | null; note: string | null }) => ({
  amount: p.amount, method: p.method, date: p.date.toISOString().slice(0, 10), month: p.month ? p.month.toISOString().slice(0, 7) : null, note: p.note,
});

/** Edits a payment (amount, method, date, month, note); the before/after is kept and shown under the payment. */
export async function editPayment(_: MemberActionState, f: FormData): Promise<MemberActionState> {
  try {
    const user = await requirePermission("payments.edit");
    const id = check(v.id("To'lov"), f.get("id"));
    const before = await db.payment.findUniqueOrThrow({ where: { id }, include: { student: true } });
    await assertStudentAccess(user, before.studentId);
    const d = parseForm(paymentSchema.omit({ studentId: true, groupId: true }), f);
    const data = { amount: d.amount, method: d.method, note: d.note, date: d.date ?? before.date, month: d.month };
    const after = snapshot(data);
    if (JSON.stringify(after) === JSON.stringify(snapshot(before))) return { ok: true };
    await db.$transaction([
      db.payment.update({ where: { id }, data }),
      db.paymentEdit.create({ data: { paymentId: id, userId: user.id, before: JSON.stringify(snapshot(before)), after: JSON.stringify(after) } }),
    ]);
    await logAction(user, "payment.edit", `To'lov tahrirlandi: ${before.student.name} — ${editDiff(snapshot(before), after)}`, { studentId: before.studentId });
    revalidatePath("/payments");
    revalidatePath(`/students/${before.studentId}`);
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
  }
}

export async function deletePayment(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("payments.delete");
    const p = await db.payment.delete({ where: { id }, include: { student: true } });
    await logAction(user, "payment.delete", `To'lov o'chirildi: ${p.student.name} — ${money(p.amount)} (${p.date.toISOString().slice(0, 10)})`, { studentId: p.studentId });
    revalidatePath(`/students/${p.studentId}`);
    revalidatePath("/payments");
  });
}

const expenseSchema = z.object({
  title: v.text("Xarajat nomi", 200),
  category: v.oneOf(EXPENSE_CATEGORIES, "OTHER"),
  amount: v.int("Summa", { min: 1 }),
  date: v.optDate(),
});

export async function createExpense(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("finance.manage");
    const { date, ...data } = parseForm(expenseSchema, f);
    const e = await db.expense.create({ data: { ...data, date: date ?? new Date() } });
    await logAction(user, "expense.create", `Xarajat: ${e.title} — ${money(e.amount)}`);
    revalidatePath("/finance");
  });
}

export async function deleteExpense(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("finance.manage");
    const e = await db.expense.findUniqueOrThrow({ where: { id }, include: { salaryPayment: true } });
    if (e.salaryPayment) throw new Error("Ish haqi xarajati Ish haqi bo'limidan o'chiriladi");
    await db.expense.delete({ where: { id } });
    await logAction(user, "expense.delete", `Xarajat o'chirildi: ${e.title} — ${money(e.amount)}`);
    revalidatePath("/finance");
  });
}

// ---------- Grades & exams ----------
const gradeScore = z.number().int().min(1, "Baho 1 dan 5 gacha bo'lishi kerak").max(5, "Baho 1 dan 5 gacha bo'lishi kerak").nullable();

/** Sets (or clears, when score is empty) a student's 1–5 lesson grade for a date. */
export async function setGrade(groupId: number, studentId: number, isoDay: string, score: number | null): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("grades.manage");
    const date = check(v.isoDay(), isoDay);
    await assertMarkAccess(user, groupId, isoDate(date));
    await assertLessonOpen(groupId, date);
    const value = check(gradeScore, score);
    const key = { groupId_studentId_date: { groupId, studentId, date } };
    if (value === null) {
      await db.grade.deleteMany({ where: { groupId, studentId, date } });
    } else {
      await db.grade.upsert({ where: key, create: { groupId, studentId, date, score: value }, update: { score: value } });
    }
    revalidatePath(`/groups/${groupId}`);
  });
}

const examSchema = z.object({
  title: v.text("Imtihon nomi", 200),
  date: v.optDate(),
  maxScore: v.int("Maksimal ball", { min: 1, max: 10_000, fallback: 100 }),
});

export async function createExam(groupId: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
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
  });
}

/**
 * Scores of an automatic level exam. The exam is saved the first time it is scored (title and date come from
 * the curriculum) and updated after that; a cleared score removes that student's result, and an exam left with
 * no results goes back to unscored (so it doesn't lock the course's subjects).
 */
export async function saveLevelExamScores(_: MemberActionState, f: FormData): Promise<MemberActionState> {
  try {
    const user = await requirePermission("grades.manage");
    const groupId = check(v.id("Guruh"), f.get("groupId"));
    const level = check(v.int("Daraja", { min: 1, max: 1000 }), f.get("level"));
    await assertGroupAccess(user, groupId);
    const group = await db.group.findUniqueOrThrow({
      where: { id: groupId },
      include: { section: { include: { subjects: true } }, schedules: true, students: { where: { leftAt: null }, select: { studentId: true } } },
    });
    // level numbers belong to the group's section, so its own lines decide the title and date
    const saved = await db.exam.findUnique({ where: { groupId_level: { groupId, level } }, select: { date: true, _count: { select: { results: true } } } });
    const auto = levelExamToSave(
      levelExams({ ...group, holidays: (await closedDaysOf())(group.id), extraDays: (await makeupDaysOf())(group.id) }, group.section?.subjects ?? []),
      level,
      saved ? { date: saved.date, scored: saved._count.results > 0 } : null,
      centreDay(),
    );
    if ("error" in auto) throw new Error(auto.error);
    const maxScore = check(v.int("Maksimal ball", { min: 1, max: 10_000, fallback: 100 }), f.get("maxScore"));
    const score = v.int("Ball", { min: 0, max: maxScore });
    const highest = await db.examResult.findFirst({ where: { exam: { groupId, level } }, orderBy: { score: "desc" } });
    if (highest && highest.score > maxScore) throw new Error(`Maksimal ball ${highest.score} dan kam bo'lishi mumkin emas — shunday natija bor`);
    const entries = group.students.map(({ studentId }) => {
      const raw = String(f.get(`score_${studentId}`) ?? "").trim();
      return { studentId, score: raw === "" ? null : check(score, raw) };
    });
    const scored = entries.filter((e): e is { studentId: number; score: number } => e.score !== null);
    await db.$transaction(async (tx) => {
      const exam = await tx.exam.upsert({
        where: { groupId_level: { groupId, level } },
        create: { groupId, level, title: auto.title, date: auto.date, maxScore },
        update: { title: auto.title, date: auto.date, maxScore },
      });
      for (const e of scored) {
        await tx.examResult.upsert({ where: { examId_studentId: { examId: exam.id, studentId: e.studentId } }, create: { examId: exam.id, studentId: e.studentId, score: e.score }, update: { score: e.score } });
      }
      const cleared = entries.filter((e) => e.score === null).map((e) => e.studentId);
      if (cleared.length) await tx.examResult.deleteMany({ where: { examId: exam.id, studentId: { in: cleared } } });
      if ((await tx.examResult.count({ where: { examId: exam.id } })) === 0) await tx.exam.delete({ where: { id: exam.id } });
    });
    await logAction(user, "exam.level", `Daraja imtihoni: ${group.name} — ${auto.title} (${scored.length} natija)`);
    revalidatePath(`/groups/${groupId}`);
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    // two people saving the same exam for the first time at once: the second hits the (group, level) unique
    if ((e as { code?: string }).code === "P2002") return { error: "Natijalar hozirgina boshqa foydalanuvchi tomonidan saqlandi — qayta urinib ko'ring" };
    return { error: errorText(e) };
  }
}

export async function deleteExam(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("grades.manage");
    const exam = await db.exam.findUniqueOrThrow({ where: { id }, include: { group: true } });
    await assertGroupAccess(user, exam.groupId);
    await db.exam.delete({ where: { id } });
    await logAction(user, "exam.delete", `Imtihon o'chirildi: ${exam.group.name} — ${exam.title}`);
    revalidatePath(`/groups/${exam.groupId}`);
  });
}

// ---------- Student notes and tags ----------
async function noteStudent(user: Awaited<ReturnType<typeof requirePermission>>, studentId: number) {
  await assertStudentAccess(user, studentId);
  return db.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true, name: true } });
}

export async function addNote(studentId: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("students.manage");
    const student = await noteStudent(user, studentId);
    const { text } = parseForm(z.object({ text: v.text("Eslatma", 2000) }), f);
    await db.studentNote.create({ data: { studentId, text, userId: user.id } });
    await logAction(user, "student.note", `Eslatma qo'shildi: ${text.slice(0, 80)}`, { studentId: student.id });
    revalidatePath(`/students/${studentId}`);
  });
}

/** Pins a note to the profile card (the previously pinned one is unpinned), or unpins it. */
export async function pinNote(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("students.manage");
    const note = await db.studentNote.findUniqueOrThrow({ where: { id } });
    await noteStudent(user, note.studentId);
    await db.$transaction([
      db.studentNote.updateMany({ where: { studentId: note.studentId, pinned: true }, data: { pinned: false } }),
      ...(note.pinned ? [] : [db.studentNote.update({ where: { id }, data: { pinned: true } })]),
    ]);
    await logAction(user, "student.note", note.pinned ? "Eslatma qadalgan joyidan olindi" : `Eslatma qadaldi: ${note.text.slice(0, 80)}`, { studentId: note.studentId });
    revalidatePath(`/students/${note.studentId}`);
  });
}

/** Its author or an admin may delete a note. */
export async function deleteNote(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("students.manage");
    const note = await db.studentNote.findUniqueOrThrow({ where: { id } });
    await noteStudent(user, note.studentId);
    if (note.userId !== user.id && !user.isAdmin) throw new Error("Faqat eslatma muallifi yoki administrator o'chira oladi");
    await db.studentNote.delete({ where: { id } });
    await logAction(user, "student.note", `Eslatma o'chirildi: ${note.text.slice(0, 80)}`, { studentId: note.studentId });
    revalidatePath(`/students/${note.studentId}`);
  });
}

/** The student's tags become exactly the ticked ones; a switched-off tag can stay but can't be newly added. */
export async function setStudentTags(studentId: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("students.manage");
    const student = await noteStudent(user, studentId);
    const wanted = f.getAll("tagId").map((x) => check(v.id("Teg"), x));
    const [current, tags] = await Promise.all([db.studentTag.findMany({ where: { studentId } }), db.tag.findMany()]);
    const has = new Set(current.map((t) => t.tagId));
    const added = wanted.filter((id) => !has.has(id) && tags.find((t) => t.id === id)?.active);
    const removed = current.map((t) => t.tagId).filter((id) => !wanted.includes(id));
    await db.$transaction([
      db.studentTag.deleteMany({ where: { studentId, tagId: { in: removed } } }),
      ...added.map((tagId) => db.studentTag.create({ data: { studentId, tagId } })),
    ]);
    const name = (id: number) => tags.find((t) => t.id === id)?.name;
    const change = [...added.map((id) => `+${name(id)}`), ...removed.map((id) => `−${name(id)}`)].join(", ");
    if (change) await logAction(user, "student.tag", `Teglar: ${change}`, { studentId: student.id });
    revalidatePath(`/students/${studentId}`);
  });
}

const tagSchema = z.object({ name: v.text("Teg nomi", 40), color: v.oneOf(TAG_COLORS, "amber") });

export async function createTag(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("students.tags");
    const d = parseForm(tagSchema, f);
    if (await db.tag.findUnique({ where: { name: d.name } })) throw new Error("Bunday teg bor");
    await db.tag.create({ data: d });
    await logAction(user, "tag.manage", `Teg qo'shildi: ${d.name}`);
    revalidatePath("/settings/tags");
  });
}

export async function updateTag(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("students.tags");
    const d = parseForm(tagSchema, f);
    const before = await db.tag.findUniqueOrThrow({ where: { id } });
    if (d.name !== before.name && (await db.tag.findUnique({ where: { name: d.name } }))) throw new Error("Bunday teg bor");
    await db.tag.update({ where: { id }, data: d });
    await logAction(user, "tag.manage", `Teg o'zgartirildi: ${before.name} → ${d.name}`);
    revalidatePath("/settings/tags");
  });
}

export async function toggleTag(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("students.tags");
    const t = await db.tag.findUniqueOrThrow({ where: { id } });
    await db.tag.update({ where: { id }, data: { active: !t.active } });
    await logAction(user, "tag.manage", `Teg ${t.active ? "o'chirildi" : "yoqildi"}: ${t.name}`);
    revalidatePath("/settings/tags");
  });
}

// ---------- Discounts (Chegirma) ----------
const monthInput = (label: string) =>
  z.preprocess((x) => (typeof x === "string" ? x.trim() : x), z.string().regex(/^\d{4}-\d{2}$/, `${label} noto'g'ri`))
    .transform((s) => new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, 1)));
const monthName = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

/** "Chegirma berish": so'm off each month of a range for one of the student's current groups. */
export async function saveDiscount(_: MemberActionState, f: FormData): Promise<MemberActionState> {
  try {
    const user = await requirePermission("students.discount");
    const d = parseForm(z.object({
      groupStudentId: v.id("Guruh"),
      amount: v.int("Chegirma summasi", { min: 0, max: 100_000_000 }),
      from: monthInput("Boshlanish oyi"),
      to: monthInput("Tugash oyi"),
      reason: v.optText(120),
    }), f);
    const gs = await db.groupStudent.findUniqueOrThrow({ where: { id: d.groupStudentId }, include: { group: true, student: true, discounts: true } });
    await assertStudentAccess(user, gs.studentId);
    const problem = discountProblem({ ...d, current: gs.leftAt === null }, gs.discounts, new Date());
    if (problem) return { error: problem };
    await db.discount.create({ data: { groupStudentId: gs.id, amount: d.amount, from: d.from, to: d.to, reason: d.reason, userId: user.id } });
    await logAction(user, "student.discount", `Chegirma: ${gs.group.name} — ${money(d.amount)}/oy, ${monthName(d.from)} – ${monthName(d.to)}${d.reason ? ` (${d.reason})` : ""}`, { studentId: gs.studentId });
    revalidatePath(`/students/${gs.studentId}`);
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
  }
}

async function discountFor(id: number) {
  const user = await requirePermission("students.discount");
  const d = await db.discount.findUniqueOrThrow({ where: { id }, include: { groupStudent: { include: { group: true } } } });
  await assertStudentAccess(user, d.groupStudent.studentId);
  return { user, d };
}

/** Only while nothing of it falls in a past month. */
export async function deleteDiscount(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const { user, d } = await discountFor(id);
    if (!canDelete(d, new Date())) throw new Error("Boshlangan chegirmani o'chirib bo'lmaydi — tugating");
    await db.discount.delete({ where: { id } });
    await logAction(user, "student.discount", `Chegirma o'chirildi: ${d.groupStudent.group.name} — ${money(d.amount)}/oy, ${monthName(d.from)} – ${monthName(d.to)}`, { studentId: d.groupStudent.studentId });
    revalidatePath(`/students/${d.groupStudent.studentId}`);
  });
}

/** A running discount stops from this month: last month becomes its final one; past months stay as charged. */
export async function endDiscount(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const { user, d } = await discountFor(id);
    const today = new Date();
    if (!canEnd(d, today)) throw new Error("Chegirma tugagan");
    const to = lastMonth(today);
    await db.discount.update({ where: { id }, data: { to } });
    await logAction(user, "student.discount", `Chegirma tugatildi: ${d.groupStudent.group.name} — ${monthName(to)} oxirgi oy`, { studentId: d.groupStudent.studentId });
    revalidatePath(`/students/${d.groupStudent.studentId}`);
  });
}

// ---------- Holidays (Bayram kunlari) ----------
/** One day or a range (1–3 yanvar), each day a row; this month onward; a day already a holiday is refused. */
export async function createHolidays(_: MemberActionState, f: FormData): Promise<MemberActionState> {
  try {
    const user = await requirePermission("holidays.manage");
    const d = parseForm(z.object({ from: v.isoDay(), to: v.optDate(), name: v.text("Nomi", 80) }), f);
    const dates = expandRange(d.from, d.to);
    const problem = holidayProblem(dates, await db.holiday.findMany({ select: { date: true, name: true } }), new Date());
    if (problem) return { error: problem };
    await db.holiday.createMany({ data: dates.map((date) => ({ date, name: d.name, userId: user.id })) });
    await logAction(user, "holiday.manage", `Bayram: ${d.name} — ${dates.map((x) => x.toISOString().slice(0, 10)).join(", ")}`);
    revalidatePath("/settings/holidays");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
  }
}

/** Only future ones: a past or today's holiday was already charged and paid for. */
export async function deleteHoliday(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("holidays.manage");
    const h = await db.holiday.findUniqueOrThrow({ where: { id } });
    if (!canDeleteHoliday(h.date, new Date())) throw new Error("O'tgan yoki bugungi bayramni o'chirib bo'lmaydi");
    await db.holiday.delete({ where: { id } });
    await logAction(user, "holiday.manage", `Bayram o'chirildi: ${h.name} — ${h.date.toISOString().slice(0, 10)}`);
    revalidatePath("/settings/holidays");
  });
}

// ---------- Lesson tools: absence reasons, cancelled lessons, substitutes ----------
/** Why an absent student missed the lesson (or clear it). Only for an absence that is already marked. */
export async function setAbsenceReason(groupId: number, studentId: number, isoDay: string, reasonId: number | null): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("attendance.mark");
    const date = check(v.isoDay(), isoDay);
    await assertMarkAccess(user, groupId, isoDate(date));
    const mark = await db.attendance.findUnique({ where: { groupId_studentId_date: { groupId, studentId, date } } });
    if (!mark || mark.present) throw new Error("Avval \"kelmadi\" deb belgilang");
    if (reasonId !== null && !(await db.absenceReason.findFirst({ where: { id: reasonId, active: true } }))) throw new Error("Sabab topilmadi");
    await db.attendance.update({ where: { id: mark.id }, data: { reasonId } });
    revalidatePath(`/groups/${groupId}`);
  });
}

const lessonChangeSchema = z.object({
  groupId: v.id("Guruh"),
  date: v.isoDay(),
  reason: v.optText(200),
  role: v.oneOf({ TEACHER: "O'qituvchi", ASSISTANT: "Yordamchi" }, "TEACHER"),
  substituteId: v.optId(),
});
const isoOf = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join(".");

/** Telegram after the response (never delays or fails the action). */
const tell = (msgs: Outgoing[]) => after(() => notify(msgs));

/** Who had the group's lesson on `day` (teacher history), both roles. */
const peopleOn = (group: { teachers: { userId: number | null; role: string; from: Date }[]; teacherId: number | null; assistantId: number | null }, day: Date) =>
  [...new Set([teacherOn(group.teachers, group, day, "TEACHER"), teacherOn(group.teachers, group, day, "ASSISTANT")].filter((id): id is number => id !== null))];

async function lessonChangeContext(user: Awaited<ReturnType<typeof requirePermission>>, groupId: number) {
  await assertGroupAccess(user, groupId);
  const [group, existing, holidays] = await Promise.all([
    db.group.findUniqueOrThrow({ where: { id: groupId }, include: { teacher: true, assistant: true, teachers: true, course: { select: { lessonMin: true } } } }),
    db.lessonChange.findMany({ where: { groupId } }),
    holidayDays(),
  ]);
  return { group, existing, holidays };
}

// ---------- make-up lessons ("Ha, roziman") ----------
const makeupSchema = z.object({ makeupDate: v.isoDay(), makeupTime: v.time(), makeupRoomId: v.optId(), makeupTeacherId: v.optId() });
type MakeupGroup = Awaited<ReturnType<typeof lessonChangeContext>>["group"];
type Makeup = { makeupDate: Date; makeupTime: string; makeupRoomId: number | null; makeupTeacherId: number | null };

/**
 * Reads and checks a make-up from the form: allowed day (today … 60 days, not a holiday, not a usual lesson day), fits
 * 08:00–20:00, and the teacher and room are free then (weekly lessons that weekday and other make-ups that date).
 * The teacher defaults to the group's teacher on the original day.
 */
async function checkMakeup(group: MakeupGroup, original: Date, f: FormData): Promise<Makeup> {
  const m = parseForm(makeupSchema, f);
  const teacherId = m.makeupTeacherId ?? teacherOn(group.teachers, group, original, "TEACHER");
  const [holidays, closed] = await Promise.all([holidayDays(), closedDaysOf()]);
  // the group's other make-ups (not the one being moved) already take their days
  const taken = (await db.lessonChange.findMany({ where: { groupId: group.id, kind: "CANCEL", makeupDate: { not: null }, NOT: { date: original } }, select: { makeupDate: true } }))
    .map((c) => c.makeupDate!.toISOString().slice(0, 10));
  const problem = makeupProblem({ date: m.makeupDate, original, today: centreDay(), days: group.days, holidays, noLesson: closed(group.id), taken });
  if (problem) throw new Error(problem);
  const minutes = group.course.lessonMin;
  if (!fitsDay(m.makeupTime, minutes)) throw new Error("Dars 08:00–20:00 oralig'ida bo'lishi kerak");
  const day = m.makeupDate.toISOString().slice(0, 10);
  const [groups, makeups] = await Promise.all([
    db.group.findMany({ where: { status: "ACTIVE", NOT: { id: group.id }, startDate: { lte: m.makeupDate } }, include: { course: { select: { lessonMin: true } } } }),
    db.lessonChange.findMany({ where: { kind: "CANCEL", makeupDate: m.makeupDate, NOT: { groupId: group.id } }, include: { group: { include: { course: { select: { lessonMin: true } } } } } }),
  ]);
  const others = [
    ...groups
      .filter((g) => lessonWeekdays(g.days).includes(m.makeupDate.getUTCDay()) && !closed(g.id).includes(day))
      .map((g) => ({ name: g.name, start: g.time, minutes: g.course.lessonMin, teacherId: g.teacherId, assistantId: g.assistantId, roomId: g.roomId })),
    ...makeups.map((c) => ({ name: `${c.group.name} (qo'shimcha)`, start: c.makeupTime ?? c.group.time, minutes: c.group.course.lessonMin, teacherId: c.makeupTeacherId, assistantId: c.group.assistantId, roomId: c.makeupRoomId })),
  ];
  const clashes = clashesOn({ start: m.makeupTime, minutes, teacherId, roomId: m.makeupRoomId }, others);
  if (clashes.length) throw new Error(clashes.join("; "));
  return { makeupDate: m.makeupDate, makeupTime: m.makeupTime, makeupRoomId: m.makeupRoomId, makeupTeacherId: teacherId };
}

/** Refuses when the make-up day already has marks or grades (they'd be lost). */
async function assertMakeupFree(groupId: number, makeupDate: Date) {
  const [marks, grades] = await Promise.all([db.attendance.count({ where: { groupId, date: makeupDate } }), db.grade.count({ where: { groupId, date: makeupDate } })]);
  const locked = makeupLocked(marks, grades);
  if (locked) throw new Error(locked);
}

/** Telegram for a moved lesson: the group's people get "ko'chirildi"; a different make-up teacher gets their own line. */
async function tellMakeup(group: MakeupGroup, original: Date, m: Makeup, changeId: number) {
  const room = m.makeupRoomId ? (await db.room.findUnique({ where: { id: m.makeupRoomId }, select: { name: true } }))?.name ?? null : null;
  const texts = makeupTexts(group.name, original, m.makeupDate, m.makeupTime, room);
  const people = peopleOn(group, original);
  const day = m.makeupDate.toISOString().slice(0, 10);
  tell([
    ...people.map((id) => ({ key: `makeup:${changeId}:${id}:${day}`, userId: id, text: texts.regular })),
    ...(m.makeupTeacherId && !people.includes(m.makeupTeacherId) ? [{ key: `makeup:${changeId}:${m.makeupTeacherId}:${day}:cover`, userId: m.makeupTeacherId, text: texts.cover }] : []),
  ]);
}

const makeupTarget = z.object({ groupId: v.id("Guruh"), date: v.isoDay() });

async function movedLesson(user: Awaited<ReturnType<typeof requirePermission>>, f: FormData) {
  const t = parseForm(makeupTarget, f);
  const { group } = await lessonChangeContext(user, t.groupId);
  // the original month's lock (makeupEditProblem) is checked by each action: moving may still be allowed
  const change = await db.lessonChange.findFirst({ where: { groupId: group.id, date: t.date, kind: "CANCEL" } });
  if (!change?.makeupDate) throw new Error("Bu darsning qo'shimcha darsi yo'q");
  await assertMakeupFree(group.id, change.makeupDate);
  return { group, change, original: t.date, oldMakeup: change.makeupDate };
}

/** "Qo'shimcha darsni ko'chirish": a new day / time / room / teacher for a moved lesson, same checks as the first time. */
export async function moveMakeup(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("lessons.manage");
    const { group, change, original, oldMakeup } = await movedLesson(user, f);
    const m = await checkMakeup(group, original, f);
    const locked = makeupEditProblem("move", original, new Date(), m.makeupTeacherId !== change.makeupTeacherId);
    if (locked) throw new Error(locked);
    await db.lessonChange.update({ where: { id: change.id }, data: m });
    await logAction(user, "lesson.change", `Qo'shimcha dars ko'chirildi: ${group.name}, ${isoOf(oldMakeup)} → ${isoOf(m.makeupDate)} ${m.makeupTime}`);
    await tellMakeup(group, original, m, change.id);
    // a replaced make-up teacher who isn't on the group hears the lesson is no longer theirs
    tell(makeupOffRecipients(peopleOn(group, original), change.makeupTeacherId, m.makeupTeacherId, true).map((id) => ({ key: `makeup-undo:${change.id}:${id}:${oldMakeup.toISOString().slice(0, 10)}`, userId: id, text: makeupUndoText(group.name, oldMakeup) })));
    revalidatePath(`/groups/${group.id}`);
  });
}

/** "Qo'shimcha darsni bekor qilish": the moved lesson becomes a plain cancel — charged or not, as the toggle says. */
export async function cancelMakeup(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("lessons.manage");
    const { group, change, original, oldMakeup } = await movedLesson(user, f);
    const locked = makeupEditProblem("cancel", original, new Date(), false);
    if (locked) throw new Error(locked);
    const charged = f.get("charged") === "1";
    await db.lessonChange.update({ where: { id: change.id }, data: { makeupDate: null, makeupTime: null, makeupRoomId: null, makeupTeacherId: null, charged } });
    await logAction(user, "lesson.change", `Qo'shimcha dars bekor qilindi: ${group.name}, ${isoOf(oldMakeup)}${charged ? " (to'lov saqlanadi)" : ""}`);
    const people = makeupOffRecipients(peopleOn(group, original), change.makeupTeacherId, null);
    tell(people.map((id) => ({ key: `makeup-undo:${change.id}:${id}:${oldMakeup.toISOString().slice(0, 10)}`, userId: id, text: makeupUndoText(group.name, oldMakeup) })));
    revalidatePath(`/groups/${group.id}`);
  });
}

/** "Darsni qoldirish": the lesson didn't happen — not charged, not paid (from November 2026), marks removed. */
export async function cancelLesson(_: MemberActionState, f: FormData): Promise<MemberActionState> {
  try {
    const user = await requirePermission("lessons.manage");
    const d = parseForm(lessonChangeSchema, f);
    const { group, existing, holidays } = await lessonChangeContext(user, d.groupId);
    const problem = lessonChangeProblem({ kind: "CANCEL", date: d.date, days: group.days, holidays, existing }, new Date());
    if (problem) return { error: problem };
    // "Ha, roziman": moved to a make-up day (money stays on this day); else the toggle decides whether it's charged
    const makeup = f.get("makeup") === "1" ? await checkMakeup(group, d.date, f) : null;
    const charged = !makeup && f.get("charged") === "1";
    const [change] = await db.$transaction([
      // role "ALL": the (group, date, kind, role) unique key then also stops a second cancel of the same lesson
      db.lessonChange.create({ data: { groupId: group.id, date: d.date, kind: "CANCEL", role: "ALL", reason: d.reason, userId: user.id, charged, ...(makeup ?? {}) } }),
      db.attendance.deleteMany({ where: { groupId: group.id, date: d.date } }),
      db.grade.deleteMany({ where: { groupId: group.id, date: d.date } }),
    ]);
    const how = makeup ? ` → ${isoOf(makeup.makeupDate)} ${makeup.makeupTime}` : charged ? " (to'lov saqlanadi)" : "";
    await logAction(user, "lesson.change", `Dars bekor qilindi: ${group.name}, ${isoOf(d.date)}${how}${d.reason ? ` (${d.reason})` : ""}`);
    if (makeup) await tellMakeup(group, d.date, makeup, change.id);
    else tell(peopleOn(group, d.date).map((id) => ({ key: `cancel:${change.id}:${id}`, userId: id, text: cancelText(group.name, d.date, d.reason) })));
    revalidatePath(`/groups/${group.id}`);
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    if ((e as { code?: string }).code === "P2002") return { error: "Bu dars allaqachon bekor qilingan" };
    return { error: errorText(e) };
  }
}

/** Undoes a cancellation (this month onward). */
export async function restoreLesson(groupId: number, isoDay: string): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("lessons.manage");
    const date = check(v.isoDay(), isoDay);
    const { group } = await lessonChangeContext(user, groupId);
    if (!lessonChangeOpen(date, new Date())) throw new Error("Faqat shu oydan boshlab");
    const cancels = await db.lessonChange.findMany({ where: { groupId, date, kind: "CANCEL" } });
    if (cancels[0]?.makeupDate) await assertMakeupFree(groupId, cancels[0].makeupDate);
    const { count } = await db.lessonChange.deleteMany({ where: { groupId, date, kind: "CANCEL" } });
    if (!count) throw new Error("Bu dars bekor qilinmagan");
    tell(peopleOn(group, date).map((id) => ({ key: `restore:${cancels[0].id}:${id}`, userId: id, text: restoreText(group.name, date) })));
    // a moved lesson's make-up is gone too: tell everyone who was to hold it
    const made = cancels[0]?.makeupDate;
    if (made) tell(makeupOffRecipients(peopleOn(group, date), cancels[0].makeupTeacherId, null).map((id) => ({ key: `makeup-undo:${cancels[0].id}:${id}:${made.toISOString().slice(0, 10)}`, userId: id, text: makeupUndoText(group.name, made) })));
    await logAction(user, "lesson.change", `Dars qayta tiklandi: ${group.name}, ${isoOf(date)}`);
    revalidatePath(`/groups/${groupId}`);
  });
}

/** "O'qituvchini almashtirish": someone else teaches this one lesson and is paid for it by their own rule. */
export async function substituteLesson(_: MemberActionState, f: FormData): Promise<MemberActionState> {
  try {
    const user = await requirePermission("lessons.manage");
    const d = parseForm(lessonChangeSchema, f);
    const { group, existing, holidays } = await lessonChangeContext(user, d.groupId);
    // who had this lesson that day (teacher history), not necessarily today's teacher / assistant
    const teacherThen = teacherOn(group.teachers, group, d.date, "TEACHER");
    const assistantThen = teacherOn(group.teachers, group, d.date, "ASSISTANT");
    const absentId = d.role === "ASSISTANT" ? assistantThen : teacherThen;
    if (d.role === "ASSISTANT" && !absentId) return { error: "Guruhda yordamchi o'qituvchi yo'q" };
    const problem = lessonChangeProblem({ kind: "SUBSTITUTE", date: d.date, days: group.days, holidays, existing, substituteId: d.substituteId, absentId, onLesson: [teacherThen, assistantThen] }, new Date());
    if (problem) return { error: problem };
    if (existing.some((e) => e.kind === "SUBSTITUTE" && e.role === d.role && e.date.getTime() === d.date.getTime())) return { error: "Bu dars uchun o'rinbosar allaqachon bor" };
    const sub = await db.user.findFirst({ where: { id: d.substituteId!, isTeacher: true, active: true } });
    if (!sub) return { error: "O'rinbosar topilmadi" };
    const change = await db.lessonChange.create({ data: { groupId: group.id, date: d.date, kind: "SUBSTITUTE", role: d.role, substituteId: sub.id, reason: d.reason, userId: user.id } });
    const absent = absentId === null ? null : (await db.user.findUnique({ where: { id: absentId }, select: { name: true } }))?.name;
    const texts = substituteTexts(group.name, d.date, group.time, sub.name, absent ?? null);
    tell([
      { key: `sub:${change.id}:${sub.id}`, userId: sub.id, text: texts.toSubstitute },
      ...(absentId ? [{ key: `sub:${change.id}:${absentId}`, userId: absentId, text: texts.toAbsent }] : []),
    ]);
    await logAction(user, "lesson.change", `O'rinbosar: ${group.name}, ${isoOf(d.date)} — ${absent ?? "—"} o'rniga ${sub.name}`);
    revalidatePath(`/groups/${group.id}`);
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
  }
}

export async function removeSubstitute(groupId: number, isoDay: string, role: string): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("lessons.manage");
    const date = check(v.isoDay(), isoDay);
    check(z.enum(["TEACHER", "ASSISTANT"]), role);
    const { group } = await lessonChangeContext(user, groupId);
    if (!lessonChangeOpen(date, new Date())) throw new Error("Faqat shu oydan boshlab");
    const subs = await db.lessonChange.findMany({ where: { groupId, date, kind: "SUBSTITUTE", role } });
    const { count } = await db.lessonChange.deleteMany({ where: { groupId, date, kind: "SUBSTITUTE", role } });
    if (!count) throw new Error("Bu darsda o'rinbosar yo'q");
    const absentId = teacherOn(group.teachers, group, date, role as "TEACHER" | "ASSISTANT");
    tell(subs.flatMap((c) => [c.substituteId, absentId].filter((id): id is number => id !== null).map((id) => ({ key: `subundo:${c.id}:${id}`, userId: id, text: substituteUndoText(group.name, date) }))));
    await logAction(user, "lesson.change", `O'rinbosar bekor qilindi: ${group.name}, ${isoOf(date)}`);
    revalidatePath(`/groups/${groupId}`);
  });
}

// Absence reasons list (Settings → Sabablar)
const absenceReasonSchema = z.object({ name: v.text("Sabab", 60), color: v.oneOf(TAG_COLORS, "grey") });

export async function createAbsenceReason(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("staff.manage");
    const d = parseForm(absenceReasonSchema, f);
    if (await db.absenceReason.findUnique({ where: { name: d.name } })) throw new Error("Bunday sabab bor");
    await db.absenceReason.create({ data: d });
    await logAction(user, "reason.create", `Kelmaganlik sababi: ${d.name}`);
    revalidatePath("/settings/reasons");
  });
}

export async function updateAbsenceReason(id: number, _: MemberActionState, f: FormData): Promise<MemberActionState> {
  try {
    const user = await requirePermission("staff.manage");
    const d = parseForm(absenceReasonSchema, f);
    if (await db.absenceReason.findFirst({ where: { name: d.name, NOT: { id } } })) return { error: "Bunday sabab bor" };
    await db.absenceReason.update({ where: { id }, data: d });
    await logAction(user, "reason.update", `Kelmaganlik sababi o'zgartirildi: ${d.name}`);
    revalidatePath("/settings/reasons");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
  }
}

export async function toggleAbsenceReason(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("staff.manage");
    const r = await db.absenceReason.findUniqueOrThrow({ where: { id } });
    await db.absenceReason.update({ where: { id }, data: { active: !r.active } });
    await logAction(user, "reason.toggle", `Kelmaganlik sababi ${r.active ? "o'chirildi" : "yoqildi"}: ${r.name}`);
    revalidatePath("/settings/reasons");
  });
}

// ---------- Teacher availability ----------
/**
 * Sets one hour of a teacher's week: free, busy or not set. Teachers edit their own; others need groups.manage.
 * Hours with a lesson are never marks — they come from the groups.
 */
export async function setSlot(userId: number, dayType: DayType, hour: number, state: "free" | "busy" | "unset"): Promise<MemberActionState> {
  try {
    const user = await requireUser();
    if (userId !== user.id || !user.isTeacher) await requirePermission("groups.manage");
    const d = check(z.object({ dayType: z.enum(DAY_TYPES), hour: z.number().int().min(DAY_START).max(DAY_END - 1), state: z.enum(["free", "busy", "unset"]) }), { dayType, hour, state });
    const teacher = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!teacher.isTeacher) throw new Error("Bu foydalanuvchi o'qituvchi emas");
    const groups = await db.group.findMany({ where: { status: "ACTIVE", OR: [{ teacherId: userId }, { assistantId: userId }] }, include: { course: { select: { lessonMin: true } } } });
    if (teacherGrid(userId, groups.map((g) => ({ ...g, minutes: g.course.lessonMin })), [])[d.dayType].get(d.hour)?.state === "lesson") throw new Error("Bu soatda dars bor");
    const key = { userId_dayType_hour: { userId, dayType: d.dayType, hour: d.hour } };
    if (d.state === "unset") await db.teacherSlot.deleteMany({ where: { userId, dayType: d.dayType, hour: d.hour } });
    else await db.teacherSlot.upsert({ where: key, create: { userId, dayType: d.dayType, hour: d.hour, free: d.state === "free" }, update: { free: d.state === "free" } });
    const label = { free: "bo'sh", busy: "band", unset: "belgilanmagan" }[d.state];
    await logAction(user, "teacher.availability", `${teacher.name}: ${DAY_TYPE_LABEL[d.dayType]} ${String(d.hour).padStart(2, "0")}:00 — ${label}`);
    revalidatePath("/availability");
    revalidatePath("/teachers");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
  }
}

// ---------- Salaries ----------
const salaryRuleSchema = z
  .object({ salaryType: v.oneOf(SALARY_TYPES), salaryAmount: v.int("Summa", { fallback: 0 }) })
  .refine((d) => d.salaryType !== "PERCENT" || d.salaryAmount <= 100, "Foiz 0–100 oralig'ida bo'lishi kerak");

export async function updateSalaryRule(userId: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const me = await requirePermission("salaries.manage");
    const { salaryType: type, salaryAmount: amount } = parseForm(salaryRuleSchema, f);
    const u = await db.user.update({ where: { id: userId }, data: { salaryType: type, salaryAmount: type === "NONE" ? 0 : amount } });
    await logAction(me, "salary.rule", `${u.name} ish haqi qoidasi: ${SALARY_TYPES[type].label}${type === "NONE" ? "" : ` — ${amount} ${SALARY_TYPES[type].unit}`}`);
    revalidatePath("/salaries");
  });
}

const salaryPaymentSchema = z.object({
  userId: v.id("Xodim"),
  month: v.month(),
  amount: v.int("Summa", { min: 1 }),
  date: v.optDate(),
  note: v.optText(500),
});

export async function paySalary(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const me = await requirePermission("salaries.manage");
    const { userId, month, amount, date: picked, note } = parseForm(salaryPaymentSchema, f);
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const date = picked ?? new Date();
    const expense = await db.expense.create({ data: { title: `Ish haqi — ${u.name} (${month})`, category: "SALARY", amount, date } });
    const payout = await db.salaryPayment.create({ data: { userId, month, amount, note, date, expenseId: expense.id } });
    await logAction(me, "salary.pay", `Ish haqi to'landi: ${u.name} — ${money(amount)} (${month})`);
    tell([{ key: `salary:${payout.id}`, userId, text: salaryText(month, amount) }]);
    revalidatePath("/salaries");
    revalidatePath("/finance");
  });
}

export async function deleteSalaryPayment(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const me = await requirePermission("salaries.manage");
    const p = await db.salaryPayment.findUniqueOrThrow({ where: { id }, include: { user: true } });
    await db.salaryPayment.delete({ where: { id } });
    if (p.expenseId) await db.expense.delete({ where: { id: p.expenseId } });
    await logAction(me, "salary.delete", `Ish haqi to'lovi bekor qilindi: ${p.user.name} — ${money(p.amount)} (${p.month})`);
    revalidatePath("/salaries");
    revalidatePath("/finance");
  });
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

export async function saveProduct(id: number | null, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
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
  });
}

const restockSchema = z.object({
  qty: v.int("Miqdor", { min: 1 }),
  cost: v.int("Tannarx", { fallback: 0 }),
  note: v.optText(500),
  asExpense: v.checkbox(),
});

/** Adds stock (purchase). Optionally records the purchase as a GOODS expense. */
export async function restockProduct(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
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
  });
}

const adjustSchema = z.object({ counted: v.int("Sanalgan miqdor"), note: v.optText(500) });

/** Sets stock to the counted amount (inventory check). */
export async function adjustStock(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("shop.manage");
    const { counted, note } = parseForm(adjustSchema, f);
    const p = await db.product.findUniqueOrThrow({ where: { id } });
    if (counted === p.stock) return;
    await db.product.update({ where: { id }, data: { stock: counted } });
    await db.stockMove.create({ data: { productId: id, type: "ADJUST", qty: counted - p.stock, note: note ?? "Inventarizatsiya" } });
    await logAction(user, "shop.adjust", `Inventarizatsiya: ${p.name} ${p.stock} → ${counted}`);
    revalidatePath("/shop");
  });
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
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
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

export async function deleteSale(id: number): Promise<ActionState> {
  return tryAction(async () => {
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
  });
}

// ---------- Reasons (why a student froze or left) ----------
const reasonSchema = z.object({ name: v.text("Sabab", 80) });

export async function createReason(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("staff.manage");
    const { name } = parseForm(reasonSchema, f);
    await db.reason.create({ data: { name } });
    await logAction(user, "reason.create", `Yangi sabab: ${name}`);
    revalidatePath("/settings/reasons");
  });
}

export async function renameReason(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("staff.manage");
    const { name } = parseForm(reasonSchema, f);
    const before = await db.reason.update({ where: { id }, data: { name } });
    await logAction(user, "reason.rename", `Sabab nomi o'zgardi: ${before.name}`);
    revalidatePath("/settings/reasons");
  });
}

/** Hidden reasons stay on old records but are no longer offered in dialogs. */
export async function toggleReason(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("staff.manage");
    const r = await db.reason.findUniqueOrThrow({ where: { id } });
    await db.reason.update({ where: { id }, data: { active: !r.active } });
    await logAction(user, "reason.toggle", `Sabab ${r.active ? "yashirildi" : "qayta yoqildi"}: ${r.name}`);
    revalidatePath("/settings/reasons");
  });
}

// ---------- Course sections and level lines (curriculum) ----------
const sectionSchema = z.object({ name: v.text("Bo'lim nomi", 60), price: v.optInt("Bo'lim narxi") });
const lineSchema = z.object({
  name: v.text("Daraja nomi", 60),
  levels: v.int("Darajalar soni", { min: 1, max: 24 }),
  lessons: v.int("Darslar soni", { min: 1, max: 60, fallback: 13 }),
});

/** Whether a group of the section has a scored level exam (then its level numbers must stay as they are). */
async function sectionScored(sectionId: number) {
  return Boolean(await db.exam.findFirst({ where: { level: { not: null }, results: { some: {} }, group: { sectionId } }, select: { id: true } }));
}

/** Refuses a change of the section's lines that would renumber scored level exams. */
async function guardLines(sectionId: number, after: (lines: LineShape[]) => LineShape[]) {
  const before = (await db.subject.findMany({ where: { sectionId }, select: { id: true, position: true, levels: true } })).sort((a, b) => a.position - b.position);
  const problem = structureProblem(before, after(before), await sectionScored(sectionId));
  if (problem) throw new Error(problem);
}

/** One action for the sections editor: add, update (name, price), move up/down, delete. */
export async function saveSection(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("courses.manage");
    const op = check(z.enum(["add", "update", "up", "down", "delete"]), f.get("op"));
    if (op === "add") {
      const courseId = check(v.id(), f.get("courseId"));
      const d = parseForm(sectionSchema, f);
      const last = await db.section.findFirst({ where: { courseId }, orderBy: { position: "desc" } });
      await db.section.create({ data: { ...d, courseId, position: (last?.position ?? 0) + 1 } });
      await logAction(user, "course.section", `Bo'lim qo'shildi: ${d.name}`);
    } else {
      const id = check(v.id(), f.get("id"));
      const s = await db.section.findUniqueOrThrow({ where: { id }, include: { _count: { select: { groups: true } } } });
      if (op === "update") {
        const d = parseForm(sectionSchema, f);
        await db.section.update({ where: { id }, data: d });
        await logAction(user, "course.section", `Bo'lim o'zgartirildi: ${s.name} → ${d.name}${d.price !== null ? ` (${money(d.price)})` : ""}`);
      } else if (op === "delete") {
        if (s._count.groups) throw new Error("Bu bo'limda guruhlar bor");
        if ((await db.section.count({ where: { courseId: s.courseId } })) <= 1) throw new Error("Kursda kamida bitta bo'lim bo'lishi kerak");
        if (await sectionScored(id)) throw new Error("Bu bo'limda daraja imtihoni baholangan — o'chirib bo'lmaydi");
        await db.section.delete({ where: { id } });
        await logAction(user, "course.section", `Bo'lim o'chirildi: ${s.name}`);
      } else {
        // sections are independent (a group studies one), so their order is only how they are listed
        const neighbour = await db.section.findFirst({
          where: { courseId: s.courseId, position: op === "up" ? { lt: s.position } : { gt: s.position } },
          orderBy: { position: op === "up" ? "desc" : "asc" },
        });
        if (neighbour) {
          await db.$transaction([
            db.section.update({ where: { id: s.id }, data: { position: neighbour.position } }),
            db.section.update({ where: { id: neighbour.id }, data: { position: s.position } }),
          ]);
        }
      }
    }
    revalidatePath("/courses");
  });
}

/** One action for a section's level lines: add, update (name, levels, lessons), move up/down, delete. */
export async function saveLine(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("courses.manage");
    const op = check(z.enum(["add", "update", "up", "down", "delete"]), f.get("op"));
    if (op === "add") {
      const sectionId = check(v.id(), f.get("sectionId"));
      const section = await db.section.findUniqueOrThrow({ where: { id: sectionId } });
      const d = parseForm(lineSchema, f);
      const last = await db.subject.findFirst({ where: { sectionId }, orderBy: { position: "desc" } });
      const position = (last?.position ?? 0) + 1;
      await guardLines(sectionId, (lines) => [...lines, { id: -1, position, levels: d.levels }]);
      await db.subject.create({ data: { ...d, months: d.levels, sectionId, courseId: section.courseId, position } });
      await logAction(user, "course.subject", `Daraja qo'shildi: ${section.name} — ${d.name} ×${d.levels} (${d.lessons} dars)`);
    } else {
      const id = check(v.id(), f.get("id"));
      const s = await db.subject.findUniqueOrThrow({ where: { id }, include: { startingGroups: { select: { name: true } } } });
      const sectionId = s.sectionId;
      if (sectionId === null) throw new Error("Bu daraja bo'limga biriktirilmagan — npm run db:curriculum-v2 ni ishga tushiring");
      if (op === "update") {
        const d = parseForm(lineSchema, f);
        await guardLines(sectionId, (lines) => lines.map((l) => (l.id === id ? { ...l, levels: d.levels } : l)));
        await db.subject.update({ where: { id }, data: { ...d, months: d.levels } });
        await logAction(user, "course.subject", `Daraja o'zgartirildi: ${s.name} → ${d.name} ×${d.levels} (${d.lessons} dars)`);
      } else if (op === "delete") {
        await guardLines(sectionId, (lines) => lines.filter((l) => l.id !== id));
        if (s.startingGroups.length) throw new Error(`"${s.startingGroups[0].name}" guruhi shu darajadan boshlangan — avval guruhning boshlanish darajasini o'zgartiring`);
        await db.subject.delete({ where: { id } });
        await logAction(user, "course.subject", `Daraja o'chirildi: ${s.name}`);
      } else {
        const neighbour = await db.subject.findFirst({
          where: { sectionId, position: op === "up" ? { lt: s.position } : { gt: s.position } },
          orderBy: { position: op === "up" ? "desc" : "asc" },
        });
        if (neighbour) {
          await guardLines(sectionId, (lines) => lines.map((l) => (l.id === s.id ? { ...l, position: neighbour.position } : l.id === neighbour.id ? { ...l, position: s.position } : l)));
          await db.$transaction([
            db.subject.update({ where: { id: s.id }, data: { position: neighbour.position } }),
            db.subject.update({ where: { id: neighbour.id }, data: { position: s.position } }),
          ]);
          await logAction(user, "course.subject", `Darajalar tartibi: ${s.name} ${op === "up" ? "yuqoriga" : "pastga"}`);
        }
      }
    }
    revalidatePath("/courses");
    revalidatePath("/groups");
  });
}

// ---------- Receipts (Sozlamalar → Chek) ----------
const receiptFormSchema = z.object({
  name: v.text("Markaz nomi", 60),
  phone: v.optText(40),
  address: v.optText(120),
  paper: z.enum(["80", "58"], { error: "Qog'oz kengligi noto'g'ri" }),
});

/** Saves Chek sozlamalari. Logo field: "" keeps the current one, "remove" goes back to the built-in, else a data URL. */
export async function saveReceipt(_: MemberActionState, f: FormData): Promise<MemberActionState> {
  try {
    const user = await requirePermission("staff.manage");
    const d = parseForm(receiptFormSchema, f);
    const current = await getReceiptSettings();
    const upload = String(f.get("logo") ?? "");
    let logo = current.logo;
    if (upload === "remove") logo = null;
    else if (upload) {
      const problem = logoProblem(upload);
      if (problem) return { error: problem };
      logo = upload;
    }
    await saveReceiptSettings({
      name: d.name, phone: d.phone ?? "", address: d.address ?? "", paper: d.paper === "58" ? 58 : 80,
      showLogo: f.get("showLogo") === "on", logo,
      lines: Object.fromEntries(RECEIPT_LINES.map((l) => [l, f.get(`line_${l}`) === "on"])) as Record<ReceiptLine, boolean>,
    });
    await logAction(user, "settings.receipt", "Chek sozlamalari o'zgartirildi");
    revalidatePath("/settings/receipt");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
  }
}

// ---------- Teacher form (O'qituvchilar → add / ✏️ edit) ----------
/**
 * Adds a teacher (no `id`) or edits one. Photo field: "" keeps the current one, "remove" clears it, else a data URL.
 * The salary rule is saved only by staff who may manage salaries (same rule and log as the Ish haqi page).
 */
export async function saveTeacher(_: MemberActionState, f: FormData): Promise<MemberActionState> {
  try {
    const me = await requirePermission("staff.manage");
    const id = f.get("id") ? check(v.id("O'qituvchi"), f.get("id")) : null;
    const { password, salaryType, salaryAmount, ...d } = parseForm(teacherFormSchema(id ? "edit" : "create"), f);
    await assertPhoneFree(d.phone, id ?? undefined);
    const upload = String(f.get("photo") ?? "");
    let photo: string | null | undefined; // undefined = unchanged
    if (upload === "remove") photo = null;
    else if (upload) {
      const problem = imageProblem(upload, "Rasm");
      if (problem) return { error: problem };
      photo = upload;
    }
    const salary = can(me, "salaries.manage") ? { salaryType, salaryAmount: salaryType === "NONE" ? 0 : salaryAmount } : {};
    const data = { ...d, isTeacher: true, ...salary, ...(photo !== undefined ? { photo } : {}) };

    if (!id) {
      const created = await db.user.create({ data: { ...data, password: await bcrypt.hash(password!, 10) }, include: { role: true } });
      await logAction(me, "staff.create", `Yangi o'qituvchi: ${created.name} (${created.role.name})`);
    } else {
      const before = await db.user.findUniqueOrThrow({ where: { id }, include: { role: true } });
      if (id === me.id && before.roleId !== d.roleId) return { error: "O'z rolingizni o'zgartira olmaysiz" };
      if (id !== me.id) await assertNotLastAdmin(id, d.roleId);
      const updated = await db.user.update({
        where: { id }, data: { ...data, ...(password ? { password: await bcrypt.hash(password, 10) } : {}) }, include: { role: true },
      });
      if (before.roleId !== updated.roleId) await logAction(me, "staff.role", `${updated.name}: rol ${before.role.name} → ${updated.role.name}`);
      if (password) await logAction(me, "staff.password", `${updated.name} paroli o'zgartirildi`);
      if ("salaryType" in salary && (before.salaryType !== updated.salaryType || before.salaryAmount !== updated.salaryAmount)) {
        const t = updated.salaryType;
        await logAction(me, "salary.rule", `${updated.name} ish haqi qoidasi: ${SALARY_TYPES[t].label}${t === "NONE" ? "" : ` — ${updated.salaryAmount} ${SALARY_TYPES[t].unit}`}`);
      }
      await logAction(me, "staff.update", `O'qituvchi ma'lumotlari o'zgartirildi: ${updated.name}`);
    }
    revalidatePath("/teachers");
    revalidatePath("/settings");
    revalidatePath("/salaries");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
  }
}

// ---------- Telegram (Sozlamalar → Telegram) ----------
export async function unlinkTelegram(userId: number): Promise<ActionState> {
  return tryAction(async () => {
    const me = await requirePermission("staff.manage");
    const u = await db.user.update({ where: { id: userId }, data: { telegramChatId: null } });
    await logAction(me, "telegram.unlink", `Telegram uzildi: ${u.name}`);
    revalidatePath("/settings/telegram");
    revalidatePath("/teachers");
  });
}

/** "Sinov xabari": a message to the admin's own linked chat, sent right away so the answer shows here. */
export async function sendTelegramTest(_: MemberActionState): Promise<MemberActionState> {
  try {
    const me = await requirePermission("staff.manage");
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return { error: "Bot tokeni o'rnatilmagan (TELEGRAM_BOT_TOKEN)" };
    const u = await db.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!u.telegramChatId) return { error: "Avval botda Start bosing va raqamingizni yuboring" };
    await telegramClient(token, 10_000).sendMessage(u.telegramChatId, "Sinov xabari ✅");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // the login redirect of an expired session must reach the browser
    return { error: errorText(e) };
  }
}

// ---------- Xavfli o'quvchilar ----------
/** Sozlamalar → Xavfli o'quvchilar: the limits behind the report. */
export async function saveRiskSettings(_: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("staff.manage");
    await storeRiskSettings(parseForm(riskSettingsSchema, f));
    await logAction(user, "risk.settings", "Xavfli o'quvchilar chegaralari o'zgartirildi");
    revalidatePath("/risk");
    revalidatePath("/settings/risk");
  });
}

const riskContactSchema = z.object({
  result: z.enum(Object.keys(CONTACT_RESULTS) as [keyof typeof CONTACT_RESULTS], { error: "Natijani tanlang" }),
  comment: v.optText(500),
});

/** "Bog'lanildi": a call to a risky student or parent; it also shows in the student's Tarix. */
export async function recordRiskContact(studentId: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("risk.view");
    const d = parseForm(riskContactSchema, f);
    await db.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true } });
    await db.riskContact.create({ data: { studentId, userId: user.id, result: d.result, comment: d.comment } });
    await logAction(user, "risk.contact", `Bog'lanildi (xavfli o'quvchi): ${CONTACT_RESULTS[d.result]}${d.comment ? ` — ${d.comment}` : ""}`, { studentId });
    revalidatePath("/risk");
  });
}

// ---------- Student documents ("Hujjatlar") ----------
/** Uploads a named PDF / PNG / JPG (≤ 2 MB, ≤ 30 per student), checked by its first bytes. */
export async function uploadDocument(studentId: number, _: ActionState, f: FormData): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("students.manage");
    await assertStudentAccess(user, studentId);
    const name = check(v.text("Hujjat nomi", 80), f.get("name"));
    const file = String(f.get("file") ?? "");
    const problem = documentProblem(file, await db.studentDocument.count({ where: { studentId } }));
    if (problem) throw new Error(problem);
    const doc = decodeDocument(file);
    await db.studentDocument.create({ data: { studentId, name, mime: doc.mime, size: doc.bytes.length, data: doc.bytes.toString("base64"), userId: user.id } });
    await logAction(user, "student.document", `Hujjat qo'shildi: ${name}`, { studentId });
    revalidatePath(`/students/${studentId}`);
  });
}

export async function deleteDocument(id: number): Promise<ActionState> {
  return tryAction(async () => {
    const user = await requirePermission("students.manage");
    const doc = await db.studentDocument.findUniqueOrThrow({ where: { id }, select: { studentId: true, name: true } });
    await assertStudentAccess(user, doc.studentId);
    await db.studentDocument.delete({ where: { id } });
    await logAction(user, "student.document", `Hujjat o'chirildi: ${doc.name}`, { studentId: doc.studentId });
    revalidatePath(`/students/${doc.studentId}`);
  });
}
