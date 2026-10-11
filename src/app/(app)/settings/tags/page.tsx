import { Eye, EyeOff, Pencil, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { TAG_COLORS } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { Empty, Field, SubmitRow } from "@/components/ui";
import { TagChip } from "@/components/students/TagChip";
import { createTag, toggleTag, updateTag } from "../../actions";

const COLOR_LABEL: Record<string, string> = { amber: "Sariq", green: "Yashil", red: "Qizil", orange: "To'q sariq", grey: "Kulrang" };

function ColorSelect({ value = "amber" }: { value?: string }) {
  return (
    <select name="color" className="input" defaultValue={value} aria-label="Rang">
      {TAG_COLORS.map((c) => <option key={c} value={c}>{COLOR_LABEL[c]}</option>)}
    </select>
  );
}

export default async function TagsPage() {
  await requirePage("students.tags");
  const tags = await db.tag.findMany({ include: { _count: { select: { students: true } } }, orderBy: [{ active: "desc" }, { name: "asc" }] });

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 md:px-5">
        <div>
          <h2 className="font-semibold">Teglar</h2>
          <p className="mt-0.5 text-sm text-muted">O&apos;quvchilarga biriktiriladi va ro&apos;yxatda filtr sifatida ishlatiladi</p>
        </div>
        <form action={createTag} className="flex w-full flex-wrap gap-2 sm:w-auto">
          <input name="name" className="input min-w-0 flex-1 sm:w-56" placeholder="Masalan: Aksiya 2+1" required maxLength={40} aria-label="Teg nomi" />
          <div className="w-32"><ColorSelect /></div>
          <button className="btn-primary shrink-0"><Plus className="h-4 w-4" /> Qo&apos;shish</button>
        </form>
      </div>
      {tags.length === 0 ? (
        <Empty text="Teglar hali qo'shilmagan" />
      ) : (
        <ul className="divide-y divide-line">
          {tags.map((t) => (
            <li key={t.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5 ${t.active ? "" : "opacity-60"}`}>
              <div className="flex min-w-0 items-center gap-3">
                <TagChip name={t.name} color={t.color} />
                <span className="text-sm text-muted">{t._count.students} o&apos;quvchi</span>
                {!t.active && <span className="label-mono">o&apos;chirilgan</span>}
              </div>
              <div className="flex gap-1">
                <Modal title="Tegni tahrirlash" triggerClassName="btn-ghost px-2" trigger={<Pencil className="h-4 w-4" aria-label="Tahrirlash" />}>
                  <form action={updateTag.bind(null, t.id)} className="space-y-3">
                    <Field label="Nomi"><input name="name" className="input" required maxLength={40} defaultValue={t.name} /></Field>
                    <Field label="Rang"><ColorSelect value={t.color} /></Field>
                    <SubmitRow />
                  </form>
                </Modal>
                <form action={toggleTag.bind(null, t.id)}>
                  <button className="btn-ghost px-2" aria-label={t.active ? "O'chirish" : "Yoqish"} title={t.active ? "O'chirish (o'quvchilarda qoladi)" : "Yoqish"}>
                    {t.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
