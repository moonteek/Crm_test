"use client";

import { useEffect, useRef, useState } from "react";
import { endOf, weekdaysOf } from "@/lib/group-days";
import { Field } from "./ui";

const NAMED = [
  { key: "ODD", label: "Toq kunlar (Du / Chor / Ju)" },
  { key: "EVEN", label: "Juft kunlar (Se / Pay / Sha)" },
  { key: "DAILY", label: "Har kuni (Du–Sha)" },
  { key: "CUSTOM", label: "Boshqa" },
];
const WEEK = [
  { day: 1, short: "Du" }, { day: 2, short: "Se" }, { day: 3, short: "Chor" },
  { day: 4, short: "Pay" }, { day: 5, short: "Ju" }, { day: 6, short: "Sha" },
];

type Saved = { days: string; time: string; endTime: string | null };

/**
 * Lesson days (Toq / Juft / Har kuni / Boshqa → Du…Sha checkboxes), start and end time. A new group's end follows its
 * course's lesson length until the end is typed. On an edit, a changed schedule asks from which day it applies.
 */
export function ScheduleFields({ courses, courseId, saved }: { courses: { id: number; lessonMin: number }[]; courseId?: number; saved?: Saved }) {
  const ref = useRef<HTMLDivElement>(null);
  const savedMode = saved ? (NAMED.some((n) => n.key === saved.days) ? saved.days : "CUSTOM") : "ODD";
  const [mode, setMode] = useState(savedMode);
  const [picked, setPicked] = useState<number[]>(saved && savedMode === "CUSTOM" ? weekdaysOf(saved.days) : []);
  const lessonMin = (id: number | undefined) => courses.find((c) => c.id === id)?.lessonMin ?? 120;
  const savedEnd = saved ? endOf({ ...saved, course: { lessonMin: lessonMin(courseId) } }) : null;
  const [time, setTime] = useState(saved?.time ?? "14:00");
  const [end, setEnd] = useState(savedEnd ?? endOf({ time: "14:00", endTime: null, course: { lessonMin: lessonMin(courseId ?? courses[0]?.id) } }));
  // a new group: the end follows start + the chosen course's length until the user types an end
  const [endTyped, setEndTyped] = useState(Boolean(saved));
  const [course, setCourse] = useState<number | undefined>(courseId ?? courses[0]?.id);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onChange = (e: Event) => {
      const t = e.target as HTMLSelectElement;
      if (t.name === "courseId") setCourse(Number(t.value) || undefined);
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    if (!endTyped && /^\d\d:\d\d$/.test(time)) setEnd(endOf({ time, endTime: null, course: { lessonMin: lessonMin(course) } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, course, endTyped]);

  const customValue = [...picked].sort((a, b) => a - b).join(",");
  const daysNow = mode === "CUSTOM" ? customValue : mode;
  const changed = saved !== undefined && (weekdaysOf(daysNow).join(",") !== weekdaysOf(saved.days).join(",") || time !== saved.time || end !== savedEnd);
  const toggle = (d: number) => setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));

  return (
    <div ref={ref} className="space-y-3">
      <Field label="Dars kunlari">
        <select name="days" className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
          {NAMED.map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}
        </select>
      </Field>
      {mode === "CUSTOM" && (
        <fieldset className="flex flex-wrap gap-2" aria-label="Dars kunlari">
          {WEEK.map((w) => (
            <label key={w.day} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${picked.includes(w.day) ? "border-ink bg-ink text-page" : "border-line text-muted hover:text-ink"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent`}>
              <input type="checkbox" className="sr-only" checked={picked.includes(w.day)} onChange={() => toggle(w.day)} />
              {w.short}
            </label>
          ))}
          <input type="hidden" name="customDays" value={customValue} />
        </fieldset>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Boshlanish vaqti">
          <input name="time" type="time" className="input" required value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Tugash vaqti">
          <input name="endTime" type="time" className="input" required value={end} onChange={(e) => { setEnd(e.target.value); setEndTyped(true); }} />
        </Field>
      </div>
      {changed && (
        <Field label="Qachondan?">
          <input name="scheduleFrom" type="date" className="input" />
          <span className="mt-1 block text-xs text-muted">Bo&apos;sh qoldirilsa — bugundan. Shu kundan oldingi darslar eski jadval bo&apos;yicha qoladi</span>
        </Field>
      )}
    </div>
  );
}
