import { z } from "zod";
import { passed } from "./curriculum";

// "Xavfli o'quvchilar": which active / trial students may drop out, and why. Pure rules over one membership's marks,
// grades and level-exam results; each reason carries the date of the newest fact behind it ("trigger"), so a call made
// on or after it covers the student until something new goes wrong.

export type RiskSettings = { streak: number; ratePercent: number; days: number; minLessons: number; lowGrade: number; gradeDrop: number; minGrades: number };

export const RISK_DEFAULTS: RiskSettings = { streak: 2, ratePercent: 70, days: 30, minLessons: 4, lowGrade: 3.5, gradeDrop: 1, minGrades: 3 };

/** Allowed range per field and whether it takes one decimal. */
const RANGES: Record<keyof RiskSettings, [number, number, boolean]> = {
  streak: [1, 10, false],
  ratePercent: [1, 100, false],
  days: [7, 120, false],
  minLessons: [1, 30, false],
  lowGrade: [1, 5, true],
  gradeDrop: [0.1, 4, true],
  minGrades: [1, 20, false],
};

const fits = (k: keyof RiskSettings, x: unknown): x is number => {
  const [min, max, decimal] = RANGES[k];
  return typeof x === "number" && Number.isFinite(x) && x >= min && x <= max && (decimal || Number.isInteger(x));
};

/** The stored limits; each missing, junk or out-of-range field falls back to its default. */
export function parseRiskSettings(json: string | null): RiskSettings {
  let raw: Record<string, unknown> = {};
  try {
    const v = json ? JSON.parse(json) : {};
    if (v && typeof v === "object") raw = v;
  } catch {
    // keep the defaults
  }
  const out = { ...RISK_DEFAULTS };
  for (const k of Object.keys(RANGES) as (keyof RiskSettings)[]) if (fits(k, raw[k])) out[k] = raw[k] as number;
  return out;
}

const LABELS: Record<keyof RiskSettings, string> = {
  streak: "Ketma-ket qoldirilgan darslar",
  ratePercent: "Davomat chegarasi",
  days: "Davr (kun)",
  minLessons: "Kamida belgilangan darslar",
  lowGrade: "Past o'rtacha baho",
  gradeDrop: "Baho tushishi",
  minGrades: "Kamida baholar soni",
};

/** The settings form (Sozlamalar → Xavfli o'quvchilar). */
export const riskSettingsSchema = z.object(
  Object.fromEntries(
    (Object.keys(RANGES) as (keyof RiskSettings)[]).map((k) => {
      const [min, max, decimal] = RANGES[k];
      const range = `${LABELS[k]}: ${min} dan ${max} gacha${decimal ? "" : " butun son"}`;
      return [k, z.coerce.number({ error: range }).refine((x) => fits(k, x), range)];
    }),
  ) as Record<keyof RiskSettings, z.ZodType<number>>,
);

export type RiskKind = "streak" | "attendance" | "grades" | "exam";
export const RISK_KINDS: Record<RiskKind, string> = { streak: "Ketma-ket", attendance: "Davomat", grades: "Baho", exam: "Imtihon" };

export type Reason = { kind: RiskKind; label: string; trigger: Date };

export type MembershipFacts = {
  marks: { date: Date; present: boolean }[];
  grades: { date: Date; score: number }[];
  levelExams: { date: Date; level: number; maxScore: number; score: number | null }[];
  passPercent: number;
};

export const CONTACT_RESULTS = { RETURNING: "Qaytadi", LEAVING: "Ketmoqchi", NO_ANSWER: "Javob bermadi", OTHER: "Boshqa" } as const;

const DAY = 86_400_000;
const EPS = 1e-9;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const newest = <T extends { date: Date }>(xs: T[]) => xs.reduce<T | null>((a, x) => (!a || x.date > a.date ? x : a), null);

/** Why this membership is risky today (empty = fine). Order: streak, attendance, low grades, falling grades, exam. */
export function membershipReasons(f: MembershipFacts, s: RiskSettings, today: Date): Reason[] {
  const out: Reason[] = [];
  const from = today.getTime() - (s.days - 1) * DAY;
  const prevFrom = today.getTime() - (2 * s.days - 1) * DAY;
  const inWindow = (d: Date) => d.getTime() >= from && d <= today;
  const inPrev = (d: Date) => d.getTime() >= prevFrom && d.getTime() < from;

  // a run of absences counted back from the newest mark (marks after today don't exist yet)
  const marks = f.marks.filter((m) => m.date <= today).sort((a, b) => b.date.getTime() - a.date.getTime());
  let run = 0;
  while (run < marks.length && !marks[run].present) run++;
  if (run >= s.streak) out.push({ kind: "streak", label: `${run} marta ketma-ket kelmadi`, trigger: marks[0].date });

  const recent = marks.filter((m) => inWindow(m.date));
  const absent = recent.filter((m) => !m.present);
  if (recent.length >= s.minLessons && absent.length) {
    const pct = ((recent.length - absent.length) / recent.length) * 100;
    if (pct < s.ratePercent - EPS) out.push({ kind: "attendance", label: `Davomat ${Math.round(pct)}% (${s.days} kun)`, trigger: newest(absent)!.date });
  }

  const grades = f.grades.filter((g) => g.date <= today);
  const now = grades.filter((g) => inWindow(g.date));
  const before = grades.filter((g) => inPrev(g.date));
  if (now.length >= s.minGrades) {
    const a = avg(now.map((g) => g.score));
    if (a < s.lowGrade - EPS) {
      const trigger = (newest(now.filter((g) => g.score < s.lowGrade)) ?? newest(now)!).date;
      out.push({ kind: "grades", label: `O'rtacha baho ${a.toFixed(1)}`, trigger });
    }
    if (before.length >= s.minGrades) {
      const b = avg(before.map((g) => g.score));
      if (b - a >= s.gradeDrop - EPS) out.push({ kind: "grades", label: `Baho tushdi: ${b.toFixed(1)} → ${a.toFixed(1)}`, trigger: newest(now)!.date });
    }
  }

  // only the latest scored level exam counts: passing the next level clears an earlier failure
  const scored = f.levelExams.filter((e) => e.score !== null && e.date <= today);
  const last = scored.reduce<(typeof scored)[number] | null>((a, e) => (!a || e.date > a.date || (+e.date === +a.date && e.level > a.level) ? e : a), null);
  if (last && !passed(last.score!, last.maxScore, f.passPercent)) {
    out.push({ kind: "exam", label: `${last.level}-daraja imtihoni: ${last.score}/${last.maxScore}`, trigger: last.date });
  }
  return out;
}

/** The newest trigger among the reasons (null when there are none). */
export function newestTrigger(reasons: Reason[]): Date | null {
  return reasons.reduce<Date | null>((a, r) => (!a || r.trigger > a ? r.trigger : a), null);
}

/** Contacted = the newest call (its centre day) is on or after the newest trigger. Nothing to call about counts as covered. */
export function isContacted(reasons: Reason[], contactDay: Date | null): boolean {
  const t = newestTrigger(reasons);
  if (!t) return true;
  return contactDay !== null && contactDay >= t;
}
