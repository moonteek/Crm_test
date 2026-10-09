import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { AUDIT_AREAS } from "@/lib/audit";
import { Empty, PageHeader } from "@/components/ui";

const PAGE_SIZE = 50;

function stamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function ActivityPage({
  searchParams,
}: { searchParams: Promise<{ user?: string; area?: string; page?: string; q?: string }> }) {
  await requirePage("audit.view");
  const { user, area, q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const where = {
    ...(user ? { userId: Number(user) } : {}),
    ...(area ? { action: { startsWith: `${area}.` } } : {}),
    ...(q ? { summary: { contains: q } } : {}),
  };
  const [logs, count, staff] = await Promise.all([
    db.auditLog.findMany({ where, include: { user: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.auditLog.count({ where }),
    db.user.findMany({ orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const link = (p: number) => {
    const sp = new URLSearchParams();
    if (user) sp.set("user", user);
    if (area) sp.set("area", area);
    if (q) sp.set("q", q);
    sp.set("page", String(p));
    return `/activity?${sp}`;
  };

  return (
    <>
      <PageHeader title="Faoliyat jurnali" subtitle="Kim, qachon, nima qildi — barcha muhim amallar" />
      <div className="card">
        <form className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
          <select name="user" defaultValue={user ?? ""} className="input w-auto">
            <option value="">Barcha xodimlar</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select name="area" defaultValue={area ?? ""} className="input w-auto">
            <option value="">Barcha bo&apos;limlar</option>
            {Object.entries(AUDIT_AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input name="q" defaultValue={q ?? ""} placeholder="Qidirish (ism, summa...)" className="input w-full sm:w-64" />
          <button className="btn-primary">Filtrlash</button>
          {(user || area || q) && <Link href="/activity" className="btn-secondary">Tozalash</Link>}
        </form>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Vaqt</th><th>Xodim</th><th>Bo&apos;lim</th><th>Amal</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="text-slate-500 tabular-nums">{stamp(l.createdAt)}</td>
                  <td className="font-medium">{l.user?.name ?? "—"}</td>
                  <td><span className="badge bg-slate-100 text-slate-600">{AUDIT_AREAS[l.action.split(".")[0]] ?? l.action}</span></td>
                  <td className="whitespace-normal">{l.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <Empty text="Yozuvlar topilmadi" />}
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between p-4 text-sm">
            <span className="text-slate-500">{count} ta yozuv · {page}/{pages}-sahifa</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={link(page - 1)} className="btn-secondary">← Oldingi</Link>}
              {page < pages && <Link href={link(page + 1)} className="btn-secondary">Keyingi →</Link>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
