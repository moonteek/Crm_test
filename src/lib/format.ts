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

/** Group levels, lowest first. */
export const GROUP_LEVELS = ["HTML", "CSS", "JS", "TS", "React", "Node.JS"] as const;
export type GroupLevel = (typeof GROUP_LEVELS)[number];

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
  GOODS: "Tovar xaridi",
  OTHER: "Boshqa",
};

export const LEAD_STATUSES: { key: string; label: string; color: string }[] = [
  { key: "NEW", label: "Yangi", color: "bg-sky-500" },
  { key: "CONTACTED", label: "Bog'lanildi", color: "bg-amber-500" },
  { key: "TRIAL", label: "Sinov darsi", color: "bg-violet-500" },
  { key: "WON", label: "O'qishga yozildi", color: "bg-emerald-500" },
  { key: "LOST", label: "Rad etdi", color: "bg-rose-500" },
];

export const LOST_REASONS = ["Narx qimmat", "Vaqt to'g'ri kelmadi", "Manzil uzoq", "Boshqa markazni tanladi", "Javob bermayapti", "Shunchaki qiziqdi", "Boshqa"];

export const ACTIVITY_TYPES: Record<string, string> = {
  CALL: "Qo'ng'iroq",
  MESSAGE: "Xabar",
  MEETING: "Uchrashuv",
  NOTE: "Izoh",
  STATUS: "Holat",
};

export const CALL_RESULTS: Record<string, string> = {
  ANSWERED: "Gaplashdik",
  NO_ANSWER: "Javob bermadi",
  BUSY: "Band",
};

export const PRODUCT_CATEGORIES: Record<string, string> = {
  BOOK: "Kitob",
  MERCH: "Merch",
  OTHER: "Boshqa",
};

export const KPI_METRICS: Record<string, { label: string; unit: string }> = {
  WON: { label: "O'qishga yozilganlar", unit: "ta" },
  REVENUE: { label: "Yangi o'quvchilardan birinchi to'lov", unit: "so'm" },
  TRIALS: { label: "Sinov darsiga yozilganlar", unit: "ta" },
  CALLS: { label: "Qo'ng'iroqlar", unit: "ta" },
  CONVERSION: { label: "Konversiya", unit: "%" },
};

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
