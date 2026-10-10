"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { saveGroup, type MemberActionState } from "@/app/(app)/actions";
import { DialogFrame } from "./Modal";
import { GroupFields } from "./GroupFields";

type Opt = { id: number; name: string };

/** "Tahrirlash" for a group; stays open and shows the reason when the save is refused. */
export function EditGroupDialog({
  group, courses, teachers, rooms,
}: {
  group: React.ComponentProps<typeof GroupFields>["g"] & { id: number };
  courses: Opt[];
  teachers: Opt[];
  rooms: Opt[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<MemberActionState, FormData>(saveGroup, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /> Tahrirlash</button>
      {open && (
        <DialogFrame title="Guruhni tahrirlash" onClose={() => setOpen(false)}>
          <form action={action} className="space-y-3">
            <input type="hidden" name="groupId" value={group.id} />
            <GroupFields courses={courses} teachers={teachers} rooms={rooms} g={group} />
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
