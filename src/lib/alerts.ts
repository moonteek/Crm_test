import { levelWindows, type CurriculumGroup, type CurriculumSubject } from "./curriculum";

export type AlertGroup = CurriculumGroup & { id: number; name: string; status: string; course: { subjects: CurriculumSubject[] } };
export type CourseEndAlert = { groupId: number; name: string; endsOn: Date; state: "ending" | "ended" };

/**
 * Groups the admin should finish soon: active groups whose course ends this month or next ("ending"),
 * and those whose course is over but are still active ("ended"). Ended first, then by end date.
 */
export function courseEndAlerts(groups: AlertGroup[], today: Date): CourseEndAlert[] {
  const horizon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 0)); // last day of next month
  const out: CourseEndAlert[] = [];
  for (const g of groups) {
    if (g.status !== "ACTIVE") continue;
    const last = levelWindows(g, g.course.subjects).at(-1);
    if (!last) continue;
    if (last.to < today) out.push({ groupId: g.id, name: g.name, endsOn: last.to, state: "ended" });
    else if (last.to <= horizon) out.push({ groupId: g.id, name: g.name, endsOn: last.to, state: "ending" });
  }
  return out.sort((a, b) => (a.state === b.state ? a.endsOn.getTime() - b.endsOn.getTime() : a.state === "ended" ? -1 : 1));
}

/** Alerts as plain values for client components (dates as ISO days). */
export const serialiseAlerts = (alerts: CourseEndAlert[]) => alerts.map((a) => ({ ...a, endsOn: a.endsOn.toISOString().slice(0, 10) }));
export type AlertItem = ReturnType<typeof serialiseAlerts>[number];
