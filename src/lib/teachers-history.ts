// Who taught a group on a given day. A change starts on its date; earlier lessons keep the earlier person.
// Groups never changed have no rows and use their current teacher / assistant.

export type TeacherRole = "TEACHER" | "ASSISTANT";
export type TeacherRow = { userId: number | null; role: string; from: Date };

export function teacherOn(
  history: TeacherRow[],
  current: { teacherId: number | null; assistantId: number | null },
  day: Date,
  role: TeacherRole,
): number | null {
  let best: TeacherRow | null = null;
  for (const row of history) {
    if (row.role === role && row.from.getTime() <= day.getTime() && (!best || row.from > best.from)) best = row;
  }
  if (best) return best.userId;
  return role === "TEACHER" ? current.teacherId : current.assistantId;
}

const ddmmyyyy = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;

/** Refuses a change dated before the latest change of the same role (that would rewrite history). */
export function checkTeacherChange(history: TeacherRow[], role: TeacherRole, from: Date): string | null {
  const latest = history.filter((r) => r.role === role).reduce<Date | null>((m, r) => (!m || r.from > m ? r.from : m), null);
  if (latest && from < latest) return `Yangi o'qituvchi sanasi oldingi almashtirishdan (${ddmmyyyy(latest)}) oldin bo'lishi mumkin emas`;
  return null;
}
