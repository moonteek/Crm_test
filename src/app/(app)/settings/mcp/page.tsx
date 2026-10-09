import { headers } from "next/headers";
import { Bot, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/access";
import { date } from "@/lib/format";
import { Empty } from "@/components/ui";
import { deleteApiToken } from "../../actions";
import { CopyBox, NewTokenForm } from "./NewTokenForm";

export default async function McpPage() {
  const user = await requirePage("mcp.use");
  const seeAll = can(user, "staff.manage");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const endpoint = `${proto}://${h.get("x-forwarded-host") ?? h.get("host")}/api/mcp`;
  const tokens = await db.apiToken.findMany({
    where: seeAll ? {} : { userId: user.id },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Bot /></div>
          <div className="text-sm text-slate-600">
            <h2 className="text-base font-semibold text-slate-900">AI yordamchini CRM ga ulash (MCP)</h2>
            <p className="mt-1">
              MCP orqali Claude kabi AI yordamchilar CRM bilan ishlay oladi: &quot;Bu oy kim qarzdor?&quot;, &quot;FE-14 guruhida
              bugungi davomatni belgila&quot;, &quot;Yangi lid qo&apos;sh&quot; kabi so&apos;rovlarni bajaradi.
            </p>
            <p className="mt-2">
              AI <b>sizning nomingizdan</b> ishlaydi va faqat sizning rolingiz (<b>{user.roleName}</b>) ruxsat bergan amallarni bajara oladi.
            </p>
          </div>
        </div>
        <div className="mt-5 border-t border-slate-100 pt-5">
          <CopyBox label="MCP server manzili" value={endpoint} />
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 font-semibold">Yangi token</h2>
        <NewTokenForm endpoint={endpoint} />
      </div>

      <div className="card overflow-x-auto">
        <h2 className="px-5 py-4 font-semibold">{seeAll ? "Barcha tokenlar" : "Mening tokenlarim"}</h2>
        <table className="table">
          <thead><tr><th>Nomi</th>{seeAll && <th>Xodim</th>}<th>Token</th><th>Yaratilgan</th><th>Oxirgi foydalanish</th><th></th></tr></thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id}>
                <td className="font-medium">{t.name}</td>
                {seeAll && <td>{t.user.name}</td>}
                <td><code className="text-xs text-slate-500">{t.prefix}…</code></td>
                <td>{date(t.createdAt)}</td>
                <td>{t.lastUsedAt ? date(t.lastUsedAt) : "—"}</td>
                <td>
                  <form action={deleteApiToken.bind(null, t.id)}>
                    <button className="flex items-center gap-1 text-xs text-rose-600 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Bekor qilish</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tokens.length === 0 && <Empty text="Tokenlar yo'q" />}
      </div>
    </div>
  );
}
