export function money(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n).replace(/ /g, " ") + " so'm";
}

export function date(d: Date | string | null | undefined) {
  if (!d) return "—";
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}`;
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

export const GROUP_DAYS: Record<string, string> = {
  ODD: "Du / Chor / Ju",
  EVEN: "Se / Pay / Sha",
  DAILY: "Har kuni",
};

export const PAYMENT_METHODS: Record<string, string> = {
  CASH: "Naqd",
  CARD: "Karta",
  TRANSFER: "O'tkazma",
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  SALARY: "Ish haqi",
  RENT: "Ijara",
  MARKETING: "Marketing",
  UTILITIES: "Kommunal",
  OTHER: "Boshqa",
};

export const LEAD_STATUSES: { key: string; label: string; color: string }[] = [
  { key: "NEW", label: "Yangi", color: "bg-sky-500" },
  { key: "CONTACTED", label: "Bog'lanildi", color: "bg-amber-500" },
  { key: "TRIAL", label: "Sinov darsi", color: "bg-violet-500" },
  { key: "WON", label: "O'qishga yozildi", color: "bg-emerald-500" },
  { key: "LOST", label: "Rad etdi", color: "bg-rose-500" },
];

export const LEAD_SOURCES = ["Instagram", "Telegram", "Facebook", "Tanish orqali", "Banner", "Boshqa"];

/** Lesson weekdays (0 = Sunday) for a group schedule. */
export function lessonWeekdays(days: string) {
  if (days === "ODD") return [1, 3, 5];
  if (days === "EVEN") return [2, 4, 6];
  return [1, 2, 3, 4, 5, 6];
}

/** All lesson dates of a group within a given month. */
export function lessonDates(days: string, year: number, month: number) {
  const weekdays = lessonWeekdays(days);
  const out: Date[] = [];
  const d = new Date(Date.UTC(year, month, 1));
  while (d.getUTCMonth() === month) {
    if (weekdays.includes(d.getUTCDay())) out.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
