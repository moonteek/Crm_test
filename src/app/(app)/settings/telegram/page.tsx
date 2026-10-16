import { CheckCircle2, CircleAlert, Send, Unlink } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { telegramClient } from "@/lib/telegram-client";
import { ActionForm } from "@/components/ActionForm";
import { Empty } from "@/components/ui";
import { sendTelegramTest, unlinkTelegram } from "../../actions";

const STATUS: Record<string, [string, string]> = {
  SENT: ["Yuborildi", "bg-success-tint text-success"],
  PENDING: ["Kutilmoqda", "bg-ink/5 text-muted"],
  SENDING: ["Yuborilmoqda", "bg-ink/5 text-muted"],
  FAILED: ["Xato", "bg-danger-tint text-danger"],
};
const time = (d: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);

/** Is the bot set up and answering? Never shows the token. */
async function botStatus(): Promise<{ on: true; username: string } | { on: false; reason: string | null }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return { on: false, reason: null };
  try {
    return { on: true, username: (await telegramClient(token, 5000).getMe()).username };
  } catch (e) {
    return { on: false, reason: (e as Error).message };
  }
}

export default async function TelegramSettingsPage() {
  await requirePage("staff.manage");
  const [status, staff, messages] = await Promise.all([
    botStatus(),
    db.user.findMany({ where: { active: true }, include: { role: true }, orderBy: { name: "asc" } }),
    db.telegramMessage.findMany({ orderBy: { id: "desc" }, take: 50, include: { user: { select: { name: true } } } }),
  ]);
  const linked = staff.filter((u) => u.telegramChatId);
  const notLinked = staff.filter((u) => !u.telegramChatId);

  return (
    <div className="space-y-4 md:space-y-6">
      <section className="card p-4 md:p-5">
        <h2 className="font-semibold">Telegram bot</h2>
        {status.on ? (
          <div className="mt-3 space-y-3">
            <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> Bot ishlayapti: <a href={`https://t.me/${status.username}`} target="_blank" rel="noopener" className="font-medium underline">@{status.username}</a></p>
            <p className="text-sm text-muted">Xodimlar botni ochib <b>Start</b> bosadi va «📱 Raqamni yuborish» tugmasi bilan raqamini yuboradi — CRM&apos;dagi raqamga mos kelsa, ulanadi.</p>
            <ActionForm action={sendTelegramTest} submitText="Sinov xabari" className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">O&apos;zingizga sinov xabari yuborish:</span>
            </ActionForm>
          </div>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            <p className="flex items-center gap-2 text-danger"><CircleAlert className="h-4 w-4" /> {status.reason ? `Bot javob bermadi: ${status.reason}` : "Token yo'q — bot o'chiq"}</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted">
              <li>Telegram&apos;da @BotFather&apos;ni oching, /newbot bilan bot yarating va tokenni oling.</li>
              <li>Serverdagi <code className="font-mono">.env</code> fayliga <code className="font-mono">TELEGRAM_BOT_TOKEN=...</code> qatorini yozing.</li>
              <li>CRM&apos;ni qayta ishga tushiring — bu sahifada bot nomi chiqadi.</li>
            </ol>
          </div>
        )}
      </section>

      <section className="card">
        <div className="border-b border-line px-4 py-4 md:px-5">
          <h2 className="font-semibold">Ulangan xodimlar · {linked.length}</h2>
        </div>
        {linked.length === 0 ? <Empty text="Hali hech kim ulanmagan" /> : (
          <ul className="divide-y divide-line">
            {linked.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.name}</p>
                  <p className="label-mono mt-0.5">{u.role.name}</p>
                </div>
                <form action={unlinkTelegram.bind(null, u.id)}>
                  <button className="btn-ghost px-2 text-danger" title="Uzish" aria-label={`${u.name} — Telegramni uzish`}><Unlink className="h-4 w-4" /></button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {notLinked.length > 0 && (
          <p className="border-t border-line px-4 py-3 text-sm text-muted md:px-5">
            <span className="label-mono mr-2">Ulanmagan</span>{notLinked.map((u) => u.name).join(", ")}
          </p>
        )}
      </section>

      <section className="card">
        <div className="border-b border-line px-4 py-4 md:px-5">
          <h2 className="flex items-center gap-2 font-semibold"><Send className="h-4 w-4" /> Oxirgi xabarlar</h2>
        </div>
        {messages.length === 0 ? <Empty text="Hali xabar yuborilmagan" /> : (
          <ul className="divide-y divide-line">
            {messages.map((m) => {
              const [label, cls] = STATUS[m.status] ?? [m.status, "bg-ink/5 text-muted"];
              return (
                <li key={m.id} className="px-4 py-3 md:px-5">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{m.user.name}</span>
                    <span className={`badge ${cls}`}>{label}</span>
                    <span className="label-mono ml-auto">{time(m.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{m.text}</p>
                  {m.status === "FAILED" && m.error && <p className="mt-0.5 text-xs text-danger">{m.error}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
