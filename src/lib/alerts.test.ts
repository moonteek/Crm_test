import { test } from "node:test";
import assert from "node:assert/strict";
import { courseEndAlerts } from "./alerts";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));
const AI = { id: 1, name: "AI", months: 2, position: 1 };
const g = (id: number, start: Date, extra: Partial<{ status: string; subjects: typeof AI[] }> = {}) => ({
  id, name: `G${id}`, status: extra.status ?? "ACTIVE", startDate: start, days: "ODD", startSubjectId: null, startLevel: 1, holidays: [] as string[],
  course: { subjects: extra.subjects ?? [AI] },
});

test("course-end alerts: ending this or next month, ended but still active", () => {
  const today = d(2026, 10, 11);
  const alerts = courseEndAlerts([
    g(1, d(2026, 9, 20)), // ends 19.11 → next month → ending
    g(2, d(2026, 8, 25)), // ends 24.10 → this month → ending
    g(3, d(2026, 7, 1)), // ended 31.08, still ACTIVE → ended
    g(4, d(2026, 7, 1), { status: "FINISHED" }), // finished groups are done
    g(5, d(2026, 10, 1)), // ends 30.11? no: 01.10 + 2 months − 1 day = 30.11 → ending
    g(6, d(2026, 11, 1)), // ends 31.12 → too far
    g(7, d(2026, 7, 1), { subjects: [] }), // no curriculum
  ], today);
  assert.deepEqual(alerts.map((a) => [a.groupId, a.state, a.endsOn.toISOString().slice(0, 10)]), [
    [3, "ended", "2026-08-31"],
    [2, "ending", "2026-10-24"],
    [1, "ending", "2026-11-19"],
    [5, "ending", "2026-11-30"],
  ]);
});
