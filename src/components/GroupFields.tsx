import { GROUP_DAYS, isoDate } from "@/lib/format";
import { Field } from "./ui";

type Opt = { id: number; name: string };

export function GroupFields({
  courses, teachers, rooms, g,
}: {
  courses: Opt[]; teachers: Opt[]; rooms: Opt[];
  g?: { name: string; courseId: number; teacherId: number | null; roomId: number | null; days: string; time: string; status: string; startDate: Date };
}) {
  return (
    <>
      <Field label="Guruh nomi"><input name="name" className="input" required defaultValue={g?.name} placeholder="Frontend-12" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kurs">
          <select name="courseId" className="input" required defaultValue={g?.courseId}>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="O'qituvchi">
          <select name="teacherId" className="input" defaultValue={g?.teacherId ?? ""}>
            <option value="">—</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dars kunlari">
          <select name="days" className="input" defaultValue={g?.days}>
            {Object.entries(GROUP_DAYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Vaqti"><input name="time" type="time" className="input" required defaultValue={g?.time ?? "14:00"} /></Field>
      </div>
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
