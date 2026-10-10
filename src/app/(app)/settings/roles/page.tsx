import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, parsePermissions } from "@/lib/permissions";
import { Modal } from "@/components/Modal";
import { Field, PageHeader, SubmitRow } from "@/components/ui";
import { createRole, deleteRole, updateRole } from "../../actions";

function PermissionChecklist({ selected, disabled }: { selected: Set<string>; disabled?: boolean }) {
  return (
    <div className="max-h-[55vh] space-y-4 overflow-y-auto rounded-lg border border-line p-4">
      {PERMISSION_GROUPS.map((g) => (
        <fieldset key={g.title}>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{g.title}</legend>
          <div className="space-y-1.5">
            {g.items.map((p) => (
              <label key={p.key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="perm"
                  value={p.key}
                  defaultChecked={selected.has(p.key)}
                  disabled={disabled}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export default async function RolesPage() {
  await requirePage("staff.manage");
  const roles = await db.role.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader title="Rollar va ruxsatlar" subtitle="Rol yarating va u qaysi bo'limlarni ko'rishi va nima qila olishini belgilang">
        <Modal wide title="Yangi rol" trigger={<><Plus className="h-4 w-4" /> Rol qo&apos;shish</>}>
          <form action={createRole} className="space-y-3">
            <Field label="Rol nomi"><input name="name" className="input" required placeholder="Masalan: Kassir, Filial menejeri" /></Field>
            <PermissionChecklist selected={new Set()} />
            <SubmitRow />
          </form>
        </Modal>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((r) => {
          const perms = parsePermissions(r);
          return (
            <div key={r.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    {r.name}
                    {r.isSystem && <Lock className="h-4 w-4 text-warning" />}
                  </h3>
                  <p className="text-sm text-muted">{r._count.users} xodim · {perms.size}/{ALL_PERMISSIONS.length} ruxsat</p>
                </div>
                {!r.isSystem && (
                  <div className="flex items-center gap-3">
                    <Modal wide title={`Rolni tahrirlash — ${r.name}`} triggerClassName="text-faint hover:text-ink" trigger={<Pencil className="h-4 w-4" />}>
                      <form action={updateRole.bind(null, r.id)} className="space-y-3">
                        <Field label="Rol nomi"><input name="name" className="input" required defaultValue={r.name} /></Field>
                        <PermissionChecklist selected={perms} />
                        <SubmitRow />
                      </form>
                    </Modal>
                    {r._count.users === 0 && (
                      <form action={deleteRole.bind(null, r.id)}>
                        <button className="text-faint hover:text-danger" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>
                      </form>
                    )}
                  </div>
                )}
              </div>
              {r.isSystem ? (
                <p className="mt-3 text-sm text-muted">Barcha ruxsatlarga ega. Bu rolni o&apos;zgartirib bo&apos;lmaydi.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-1">
                  {PERMISSION_GROUPS.map((g) => {
                    const n = g.items.filter((i) => perms.has(i.key)).length;
                    if (!n) return null;
                    return (
                      <span key={g.title} className="badge bg-ink/5 text-ink">
                        {g.title} {n}/{g.items.length}
                      </span>
                    );
                  })}
                  {perms.size === 0 && <span className="text-sm text-faint">Hech qanday ruxsat yo&apos;q</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
