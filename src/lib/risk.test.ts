import { test } from "node:test";
import assert from "node:assert/strict";
import { isContacted, membershipReasons, parseRiskSettings, RISK_DEFAULTS, type MembershipFacts, type Reason, type RiskKind } from "./risk";

const d = (s: string) => new Date(s + "T00:00:00Z");
const today = d("2026-10-21");
const S = RISK_DEFAULTS;
const facts = (p: Partial<MembershipFacts>): MembershipFacts => ({ marks: [], grades: [], levelExams: [], passPercent: 60, ...p });
const marks = (...m: [string, "P" | "A"][]) => m.map(([day, x]) => ({ date: d(day), present: x === "P" }));
const grades = (...g: [string, number][]) => g.map(([day, score]) => ({ date: d(day), score }));
const reasons = (f: MembershipFacts) => membershipReasons(f, S, today);
const of = (r: Reason[], kind: RiskKind) => r.filter((x) => x.kind === kind);

test("streak: two absences in a row are risky, a present (or late) mark breaks the run", () => {
  assert.deepEqual(of(reasons(facts({ marks: marks(["2026-10-15", "P"], ["2026-10-17", "A"], ["2026-10-20", "A"]) })), "streak"), [
    { kind: "streak", label: "2 marta ketma-ket kelmadi", trigger: d("2026-10-20") },
  ]);
  assert.deepEqual(of(reasons(facts({ marks: marks(["2026-10-17", "A"], ["2026-10-20", "P"]) })), "streak"), []);
  assert.deepEqual(of(reasons(facts({ marks: marks(["2026-10-17", "P"], ["2026-10-20", "A"]) })), "streak"), []);
});

test("streak: marks after today are ignored", () => {
  const r = of(reasons(facts({ marks: marks(["2026-10-17", "A"], ["2026-10-20", "A"], ["2026-10-23", "P"]) })), "streak");
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].trigger, d("2026-10-20"));
});

test("attendance: under the limit with enough marked lessons", () => {
  const low = of(reasons(facts({ marks: marks(["2026-10-01", "P"], ["2026-10-06", "P"], ["2026-10-08", "A"], ["2026-10-13", "A"], ["2026-10-15", "A"]) })), "attendance");
  assert.deepEqual(low, [{ kind: "attendance", label: "Davomat 40% (30 kun)", trigger: d("2026-10-15") }]);
  assert.deepEqual(of(reasons(facts({ marks: marks(["2026-10-08", "A"], ["2026-10-13", "A"], ["2026-10-15", "A"]) })), "attendance"), []);
  assert.deepEqual(of(reasons(facts({ marks: marks(["2026-10-06", "P"], ["2026-10-08", "P"], ["2026-10-13", "A"], ["2026-10-15", "P"]) })), "attendance"), []);
  assert.deepEqual(of(reasons(facts({ marks: marks(["2026-09-15", "A"], ["2026-09-18", "A"], ["2026-09-20", "A"], ["2026-10-15", "P"], ["2026-10-17", "P"]) })), "attendance"), []);
});

test("low grades: average under the limit needs enough grades", () => {
  const low = of(reasons(facts({ grades: grades(["2026-10-05", 3], ["2026-10-10", 3], ["2026-10-15", 4]) })), "grades");
  assert.deepEqual(low, [{ kind: "grades", label: "O'rtacha baho 3.3", trigger: d("2026-10-10") }]);
  assert.deepEqual(of(reasons(facts({ grades: grades(["2026-10-05", 3], ["2026-10-10", 3]) })), "grades"), []);
  assert.deepEqual(of(reasons(facts({ grades: grades(["2026-10-05", 4], ["2026-10-10", 4], ["2026-10-15", 4]) })), "grades"), []);
});

test("falling grades: drop of at least the limit against the previous period", () => {
  const fell = of(reasons(facts({ grades: grades(["2026-09-01", 5], ["2026-09-05", 5], ["2026-09-10", 4], ["2026-10-01", 4], ["2026-10-05", 4], ["2026-10-10", 3]) })), "grades");
  assert.deepEqual(fell, [{ kind: "grades", label: "Baho tushdi: 4.7 → 3.7", trigger: d("2026-10-10") }]);
  assert.deepEqual(of(reasons(facts({ grades: grades(["2026-09-01", 5], ["2026-09-05", 4], ["2026-09-10", 4], ["2026-10-01", 4], ["2026-10-05", 4], ["2026-10-10", 3]) })), "grades"), []);
  assert.deepEqual(of(reasons(facts({ grades: grades(["2026-09-01", 5], ["2026-09-05", 5], ["2026-10-01", 4], ["2026-10-05", 4], ["2026-10-10", 3]) })), "grades"), []);
});

test("level exam: the latest scored level exam decides", () => {
  const exam = (day: string, level: number, score: number | null) => ({ date: d(day), level, maxScore: 100, score });
  assert.deepEqual(of(reasons(facts({ levelExams: [exam("2026-09-10", 1, 45), exam("2026-10-10", 2, 70)] })), "exam"), []);
  assert.deepEqual(of(reasons(facts({ levelExams: [exam("2026-10-10", 2, 45), exam("2026-09-10", 1, 70)] })), "exam"), [
    { kind: "exam", label: "2-daraja imtihoni: 45/100", trigger: d("2026-10-10") },
  ]);
  assert.deepEqual(of(reasons(facts({ levelExams: [exam("2026-09-10", 1, 45), exam("2026-10-10", 2, null)] })), "exam"), [
    { kind: "exam", label: "1-daraja imtihoni: 45/100", trigger: d("2026-09-10") },
  ]);
});

test("a trial student with no marks, grades or exams has no reasons", () => {
  assert.deepEqual(reasons(facts({})), []);
});

test("contacted: a call on or after the newest trigger covers the student; a newer problem reopens", () => {
  const r: Reason[] = [
    { kind: "attendance", label: "x", trigger: d("2026-10-15") },
    { kind: "streak", label: "y", trigger: d("2026-10-20") },
  ];
  assert.equal(isContacted(r, d("2026-10-20")), true);
  assert.equal(isContacted(r, d("2026-10-19")), false);
  assert.equal(isContacted(r, null), false);
  assert.equal(isContacted([], null), true);
});

test("settings: defaults, per-field fallback for junk and out-of-range values", () => {
  assert.deepEqual(parseRiskSettings(null), RISK_DEFAULTS);
  const s = parseRiskSettings('{"streak":3,"ratePercent":500,"lowGrade":"x"}');
  assert.equal(s.streak, 3);
  assert.equal(s.ratePercent, 70);
  assert.equal(s.lowGrade, 3.5);
  assert.deepEqual(parseRiskSettings("not json"), RISK_DEFAULTS);
});

test("the risk permission exists for roles", async () => {
  const { ALL_PERMISSIONS } = await import("./permissions");
  assert.ok(ALL_PERMISSIONS.includes("risk.view"));
});
