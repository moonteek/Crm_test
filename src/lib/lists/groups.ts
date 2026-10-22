import "server-only";
import { db } from "../db";
import { groupScope, type CurrentUser } from "../access";
import { priceNow } from "../billing";
import { curriculumOn, type Progress } from "../curriculum";
import { centreDay } from "../membership-db";
import { closedDaysOf, makeupDaysOf } from "../holidays-db";
import { loadUnmarkedToday } from "./unmarked";
import { fmtDate, type Table } from "../export";
import { daysLabel } from "../group-days";

export const PROGRESS: Record<Progress["state"], string> = {
  "not-started": "Boshlanmagan",
  "in-progress": "O'qimoqda",
  finishing: "Oxirgi oy",
  finished: "Kursi tugagan",
  none: "Darajalarsiz",
};

export type GroupFilters = { status?: string; course?: string; subject?: string; progress?: string; unmarked?: string };

/** The groups list (Faol / Arxiv, course, current subject, progress): the page and its export. */
export async function loadGroups(user: CurrentUser, params: GroupFilters) {
  const status = params.status === "FINISHED" ? "FINISHED" : "ACTIVE";
  const courseId = Number(params.course) || null;
  const asked = Number(params.subject) || null;
  const progress = params.progress && params.progress in PROGRESS ? (params.progress as Progress["state"]) : null;
  const [all, courses] = await Promise.all([
    db.group.findMany({
      where: { status, ...(courseId ? { courseId } : {}), ...groupScope(user) },
      include: { course: { include: { _count: { select: { sections: true } } } }, section: { include: { subjects: { orderBy: { position: "asc" } } } }, teacher: true, assistant: true, room: true, prices: true, _count: { select: { students: { where: { leftAt: null } } } } },
      orderBy: [{ days: "asc" }, { time: "asc" }],
    }),
    db.course.findMany({ orderBy: { name: "asc" }, include: { sections: { orderBy: { position: "asc" }, include: { subjects: { orderBy: { position: "asc" } } } } } }),
  ]);
  const subjectOptions = courses.filter((c) => !courseId || c.id === courseId).flatMap((c) => c.sections.flatMap((sec) => sec.subjects.map((s) => ({ id: s.id, label: [courseId ? null : c.name, c.sections.length > 1 ? sec.name : null, s.name].filter(Boolean).join(" · ") }))));
  // a subject of another course (left in the link after switching course) is ignored
  const subjectId = subjectOptions.some((s) => s.id === asked) ? asked : null;
  const today = centreDay();
  const closed = await closedDaysOf();
  const makeups = await makeupDaysOf();
  // "Davomat qilinmagan": only groups whose lesson started today and aren't marked
  const unmarkedIds = params.unmarked === "1" ? new Set((await loadUnmarkedToday(user)).map((g) => g.id)) : null;
  const groups = all
    .map((g) => ({ ...g, cur: curriculumOn({ ...g, holidays: closed(g.id), extraDays: makeups(g.id) }, g.section?.subjects ?? [], today) }))
    .filter((g) => (!subjectId || (g.cur.progress.state !== "finished" && g.cur.progress.window?.subjectId === subjectId)) && (!progress || g.cur.progress.state === progress))
    .filter((g) => !unmarkedIds || unmarkedIds.has(g.id));
  const where = (g: (typeof groups)[number]) => {
    const p = g.cur.progress;
    return p.state === "none" ? g.level : p.state === "finished" ? "Bo'lim tugadi" : p.window ? [g.course._count.sections > 1 ? g.section?.name : null, p.window.label].filter(Boolean).join(" · ") : PROGRESS[p.state];
  };
  const table: Table = {
    title: status === "FINISHED" ? "Guruhlar arxivi" : "Guruhlar",
    columns: ["Guruh", "Kurs", "Hozirgi daraja", "Kunlar", "Vaqt", "O'qituvchi", "Yordamchi", "Xona", "O'quvchilar", "Narx", "Boshlangan"],
    rows: groups.map((g) => [
      g.name, g.course.name, where(g), daysLabel(g.days), g.time, g.teacher?.name ?? null, g.assistant?.name ?? null,
      g.room?.name ?? null, g._count.students, priceNow(g), fmtDate(g.startDate),
    ]),
  };
  return { status, courseId, subjectId, progress, unmarked: Boolean(unmarkedIds), courses, subjectOptions, groups, table };
}
