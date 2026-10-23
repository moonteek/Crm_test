import { GROUP_LEVELS, isoDate } from "@/lib/format";
import { Field } from "./ui";
import { CourseStartFields, type CourseOption } from "./CourseStartFields";
import { ScheduleFields } from "./ScheduleFields";

type Opt = { id: number; name: string };

export function GroupFields({
  courses, teachers, rooms, g,
}: {
  courses: CourseOption[]; teachers: Opt[]; rooms: Opt[];
  g?: { name: string; level: string | null; price: number | null; courseId: number; sectionId: number | null; startSubjectId: number | null; startLevel: number; teacherId: number | null; assistantId: number | null; roomId: number | null; days: string; time: string; endTime: string | null; status: string; startDate: Date };
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Guruh nomi"><input name="name" className="input" required defaultValue={g?.name} placeholder="Frontend-12" /></Field>
        <Field label="Daraja (darajalarsiz kurslar uchun)">
          <select name="level" className="input" defaultValue={g?.level ?? ""}>
            <option value="">—</option>
            {GROUP_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CourseStartFields courses={courses} courseId={g?.courseId} sectionId={g?.sectionId} startSubjectId={g?.startSubjectId} startLevel={g?.startLevel} price={g?.price} />
      </div>
      <div className="grid grid-cols-1 gap-3">
        <Field label="O'qituvchi">
          <select name="teacherId" className="input" defaultValue={g?.teacherId ?? ""}>
            <option value="">—</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      </div>
      {g && (
        <Field label="O'qituvchi yoki yordamchi almashsa — qaysi kundan">
          <input name="teacherFrom" type="date" className="input" />
          <span className="mt-1 block text-xs text-muted">Bo&apos;sh qoldirilsa — bugundan. Shu kungacha bo&apos;lgan darslar oldingi o&apos;qituvchiga hisoblanadi</span>
        </Field>
      )}
      <Field label="Yordamchi o'qituvchi (ixtiyoriy)">
        <select name="assistantId" className="input" defaultValue={g?.assistantId ?? ""}>
          <option value="">—</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <ScheduleFields courses={courses} courseId={g?.courseId} saved={g ? { days: g.days, time: g.time, endTime: g.endTime } : undefined} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Xona">
          <select name="roomId" className="input" defaultValue={g?.roomId ?? ""}>
            <option value="">—</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        {g ? (
          <Field label="Holat">
            <select name="status" className="input" defaultValue={g.status}>
              <option value="ACTIVE">Faol</option>
              <option value="FINISHED">Tugagan</option>
            </select>
          </Field>
        ) : (
          <Field label="Boshlanish sanasi"><input name="startDate" type="date" className="input" defaultValue={isoDate(new Date())} /></Field>
        )}
      </div>
    </>
  );
}
