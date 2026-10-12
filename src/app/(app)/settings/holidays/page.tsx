import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { canDeleteHoliday } from "@/lib/holidays";
import { centreToday } from "@/lib/schedule";
import { Empty } from "@/components/ui";
import { HolidayForm } from "@/components/HolidayForm";
import { deleteHoliday } from "../../actions";

const WEEKDAY = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const pad = (n: number) => String(n).padStart(2, "0");
const day = (d: Date) => `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;

export default async function HolidaysPage() {
  await requirePage("holidays.manage");
  const holidays = await db.holiday.findMany({ include: { user: { select: { name: true } } }, orderBy: { date: "asc" } });
  const now = new Date();
  const t = centreToday(now);
  const todayKey = Date.UTC(t.year, t.month - 1, t.day);
  const upcoming = holidays.filter((h) => h.date.getTime() >= todayKey);
  const past = holidays.filter((h) => h.date.getTime() < todayKey).reverse();

  const row = (h: (typeof holidays)[number], faded: boolean) => (
    <li key={h.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5 ${faded ? "opacity-60" : ""}`}>
      <div className="min-w-0">
        <p className="font-medium">{h.name}</p>
        <p className="label-mono">{day(h.date)} · {WEEKDAY[h.date.getUTCDay()]}{h.user ? ` · ${h.user.name}` : ""}</p>
      </div>
      {canDeleteHoliday(h.date, now) && (
        <form action={deleteHoliday.bind(null, h.id)}>
          <button className="btn-ghost px-2 hover:text-danger" aria-label="O'chirish" title="O'chirish"><Trash2 className="h-4 w-4" /></button>
        </form>
      )}
    </li>
  );

  return (
    <div className="card">
      <div className="space-y-3 border-b border-line px-4 py-4 md:px-5">
        <div>
          <h2 className="font-semibold">Bayram kunlari</h2>
          <p className="mt-0.5 text-sm text-muted">Markaz yopiq kunlar: dars bo&apos;lmaydi, to&apos;lov olinmaydi, o&apos;qituvchiga hisoblanmaydi</p>
        </div>
        <HolidayForm min={`${t.year}-${pad(t.month)}-01`} />
      </div>
      {holidays.length === 0 && <Empty text="Bayram kunlari hali kiritilmagan" />}
      {upcoming.length > 0 && <ul className="divide-y divide-line">{upcoming.map((h) => row(h, false))}</ul>}
      {past.length > 0 && (
        <>
          <p className="label-mono border-t border-line px-4 pt-4 pb-1 md:px-5">O&apos;tganlar</p>
          <ul className="divide-y divide-line">{past.map((h) => row(h, true))}</ul>
        </>
      )}
    </div>
  );
}
