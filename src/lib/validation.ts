import { z } from "zod";

/**
 * Form fields arrive as strings. Blank values become `undefined`, so `.optional()` / `.default()`
 * treat an empty input like a missing one; numbers may contain spaces ("1 500 000").
 */
const clean = (v: unknown) => {
  if (typeof v !== "string") return v ?? undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
};
const toNumber = (v: unknown) => {
  const t = clean(v);
  return typeof t === "string" ? Number(t.replace(/\s/g, "")) : t;
};
const toDate = (v: unknown) => {
  const t = clean(v);
  return typeof t === "string" ? new Date(t) : t;
};

const keys = (options: readonly string[] | Record<string, unknown>) =>
  (Array.isArray(options) ? [...options] : Object.keys(options)) as [string, ...string[]];

const passwordRule = () =>
  z.string({ error: "Parol kiritilmagan" }).min(6, "Parol kamida 6 belgidan iborat bo'lishi kerak")
    .refine((s) => Buffer.byteLength(s) <= 72, "Parol juda uzun (ko'pi bilan 72 bayt)");

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const v = {
  /** Required text. */
  text: (label: string, max = 200) =>
    z.preprocess(clean, z.string({ error: `${label} kiritilmagan` }).max(max, `${label} juda uzun (ko'pi bilan ${max} belgi)`)),
  /** Optional text; blank becomes null. */
  optText: (max = 1000) => z.preprocess(clean, z.string().max(max, `Matn juda uzun (ko'pi bilan ${max} belgi)`).nullable().default(null)),
  /** Whole number within [min, max]. Pass `fallback` to make it optional. */
  int: (label: string, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback }: { min?: number; max?: number; fallback?: number } = {}) => {
    const n = z
      .number({ error: `${label}: son kiriting` })
      .int(`${label}: butun son kiriting`)
      .min(min, `${label} ${min} dan kam bo'lmasligi kerak`)
      .max(max, `${label} ${max} dan oshmasligi kerak`);
    return z.preprocess(toNumber, fallback === undefined ? n : n.default(fallback));
  },
  id: (label = "ID") => z.preprocess(toNumber, z.number({ error: `${label} tanlanmagan` }).int().positive()),
  /** Optional whole number (e.g. a price); blank becomes null. */
  optInt: (label: string, { min = 0 }: { min?: number } = {}) =>
    z.preprocess(toNumber, z.number({ error: `${label}: son kiriting` }).int(`${label}: butun son kiriting`).min(min, `${label} ${min} dan kam bo'lmasligi kerak`).nullable().default(null)),
  /** Optional id; blank becomes null. */
  optId: () => z.preprocess(toNumber, z.number().int().positive().nullable().default(null)),
  /** Date or date-time input; blank becomes null. */
  optDate: () => z.preprocess(toDate, z.date({ error: "Sana noto'g'ri" }).nullable().default(null)),
  /** One of the list's values or the record's keys; blank becomes `fallback` (required when there is none). */
  oneOf: <F extends string | null = never>(options: readonly string[] | Record<string, unknown>, fallback?: F) => {
    const e = z.enum(keys(options), { error: "Noto'g'ri qiymat" });
    return z.preprocess(clean, fallback === undefined ? e : e.nullable().default(fallback as string)) as z.ZodType<string | F>;
  },
  /** HH:MM */
  time: () => z.preprocess(clean, z.string({ error: "Vaqt kiritilmagan" }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Vaqt HH:MM formatida bo'lishi kerak")),
  /** bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently truncated. */
  password: () => z.preprocess(clean, passwordRule()),
  /** Blank means "keep the current password". */
  optPassword: () => z.preprocess(clean, passwordRule().optional()),
  checkbox: () => z.preprocess((x) => x === "on", z.boolean()),
  month: () => z.string().regex(MONTH_RE, "Oy YYYY-MM formatida bo'lishi kerak"),
  isoDay: () => z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Sana noto'g'ri").transform((s) => new Date(s)).pipe(z.date({ error: "Sana noto'g'ri" })),
};

/** Validates a form against `schema`; throws one readable message listing every problem. */
export function parseForm<S extends z.ZodType>(schema: S, f: FormData): z.output<S> {
  return check(schema, Object.fromEntries(f));
}

/** Validates any value (e.g. a server action argument) against `schema`. */
export function check<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const res = schema.safeParse(value);
  if (!res.success) throw new Error(res.error.issues.map((i) => i.message).join("; "));
  return res.data;
}
