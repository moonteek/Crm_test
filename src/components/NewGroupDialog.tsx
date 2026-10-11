"use client";

import { useActionState, startTransition, useState } from "react";
import { Plus } from "lucide-react";
import { saveNewGroup, type MemberActionState } from "@/app/(app)/actions";
import { DialogFrame } from "./Modal";
import { GroupFields } from "./GroupFields";
import type { CourseOption } from "./CourseStartFields";

type Opt = { id: number; name: string };

/** "Guruh ochish": stays open and shows why the group can't be opened (time, teacher or room clash). */
export function NewGroupDialog({ courses, teachers, rooms }: { courses: CourseOption[]; teachers: Opt[]; rooms: Opt[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<MemberActionState, FormData>(saveNewGroup, null);

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Guruh ochish</button>
      {open && (
        <DialogFrame title="Yangi guruh" onClose={() => setOpen(false)}>
          {/* submitted by hand: a form action would clear everything typed when the save is refused */}
          <form onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); startTransition(() => action(data)); }} className="space-y-3">
            <GroupFields courses={courses} teachers={teachers} rooms={rooms} />
            {state?.error && <p className="rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{state.error}</p>}
            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saqlanmoqda..." : "Saqlash"}</button>
            </div>
          </form>
        </DialogFrame>
      )}
    </>
  );
}
