import { levelExams, type CurriculumGroup, type CurriculumSubject } from "./curriculum";

type SavedExam = { id: number; level: number | null; title: string; date: Date; maxScore: number; results: { studentId: number; score: number }[] };
export type ExamColumn = { key: string; id: number | null; level: number | null; title: string; date: Date; maxScore: number; results: { studentId: number; score: number }[]; upcoming: boolean };

/** The group's exam columns: every automatic level exam (scored or not yet) and the exams added by hand, by date. */
export function examColumns<E extends SavedExam>(group: CurriculumGroup, subjects: CurriculumSubject[], exams: E[], today: Date): (ExamColumn & { results: E["results"] })[] {
  const auto = levelExams(group, subjects);
  const autoLevels = new Set(auto.map((a) => a.level));
  return [
    ...auto.map((a) => {
      const saved = exams.find((e) => e.level === a.level);
      return { key: `L${a.level}`, id: saved?.id ?? null, level: a.level as number | null, title: a.title, date: saved?.results.length ? saved.date : a.date, maxScore: saved?.maxScore ?? 100, results: saved?.results ?? [], upcoming: !saved?.results.length && a.date > today };
    }),
    ...exams.filter((e) => e.level === null || !autoLevels.has(e.level)).map((e) => ({ key: `E${e.id}`, id: e.id as number | null, level: null as number | null, title: e.title, date: e.date, maxScore: e.maxScore, results: e.results, upcoming: false })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}
