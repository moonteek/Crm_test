import { test } from "node:test";
import assert from "node:assert/strict";
import { filterRows, type RiskRow } from "./risk";

const d = (s: string) => new Date(s + "T00:00:00Z");
const student = (id: number) => ({ id, name: `S${id}`, phone: "90", fatherPhone: null, motherPhone: null });
// A: two risky groups, not called yet. B: one group, called after its problem.
const A: RiskRow = {
  student: student(1),
  groups: [
    { id: 1, name: "G1", teacherId: 10, teacher: "T10", reasons: [{ kind: "streak", label: "2 marta ketma-ket kelmadi", trigger: d("2026-10-20") }] },
    { id: 2, name: "G2", teacherId: 20, teacher: "T20", reasons: [{ kind: "exam", label: "1-daraja imtihoni: 40/100", trigger: d("2026-10-10") }] },
  ],
  contact: null, contacted: false, newest: d("2026-10-20"),
};
const B: RiskRow = {
  student: student(2),
  groups: [{ id: 1, name: "G1", teacherId: 10, teacher: "T10", reasons: [{ kind: "attendance", label: "Davomat 50% (30 kun)", trigger: d("2026-10-18") }] }],
  contact: { at: d("2026-10-19"), who: "Admin", result: "RETURNING", comment: null }, contacted: true, newest: d("2026-10-18"),
};
const ids = (rows: RiskRow[]) => rows.map((r) => r.student.id);

test("tabs: open by default, done, all", () => {
  assert.deepEqual(ids(filterRows([B, A], {})), [1]);
  assert.deepEqual(ids(filterRows([B, A], { tab: "done" })), [2]);
  assert.deepEqual(ids(filterRows([B, A], { tab: "all" })), [1, 2]); // A first: more reasons
});

test("group filter keeps only that group's entry", () => {
  const [row, ...rest] = filterRows([A, B], { group: "2" });
  assert.equal(rest.length, 0);
  assert.equal(row.student.id, 1);
  assert.deepEqual(row.groups.map((g) => g.id), [2]);
  assert.deepEqual(row.groups[0].reasons.map((r) => r.kind), ["exam"]);
});

test("kind filter keeps matching reasons only", () => {
  assert.deepEqual(ids(filterRows([A, B], { kind: "attendance", tab: "all" })), [2]);
  assert.deepEqual(ids(filterRows([A, B], { kind: "bogus", tab: "all" })), [1, 2]);
});

test("teacher filter", () => {
  const rows = filterRows([A, B], { teacher: "20", tab: "all" });
  assert.deepEqual(ids(rows), [1]);
  assert.deepEqual(rows[0].groups.map((g) => g.id), [2]);
  assert.deepEqual(ids(filterRows([A, B], { teacher: "10", tab: "all" })), [1, 2]);
});

test("level exams are matched to each membership quickly, even for a big centre", async () => {
  const { levelExamsByMembership } = await import("./risk");
  const day = new Date("2026-10-01T00:00:00Z");
  // 900 groups × 20 students, 10 level exams per group with every student scored (the nested-loop version took ~1 s)
  const members = Array.from({ length: 18000 }, (_, i) => ({ groupId: Math.floor(i / 20), studentId: i }));
  const exams = Array.from({ length: 9000 }, (_, i) => {
    const groupId = Math.floor(i / 10);
    return { groupId, date: day, level: (i % 10) + 1, maxScore: 100, results: Array.from({ length: 20 }, (_, j) => ({ studentId: groupId * 20 + j, score: 50 })) };
  });
  const t = performance.now();
  const map = levelExamsByMembership(exams, members);
  const ms = performance.now() - t;
  assert.equal(map.get("5:100")!.length, 10);
  assert.equal(map.get("5:100")![0].score, 50);
  assert.ok(ms < 400, `took ${Math.round(ms)} ms`);
});
