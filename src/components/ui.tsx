import Link from "next/link";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function StatCard({
  label, value, icon, tone = "brand", href,
}: {
  label: string; value: string | number; icon: React.ReactNode; tone?: "brand" | "green" | "amber" | "rose"; href?: string;
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
  };
  const body = (
    <div className="card flex items-center gap-4 p-5 transition hover:shadow-md">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="truncate text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const LEVEL_TONES: Record<string, string> = {
  HTML: "bg-orange-100 text-orange-700",
  CSS: "bg-sky-100 text-sky-700",
  JS: "bg-yellow-100 text-yellow-800",
  TS: "bg-blue-100 text-blue-700",
  React: "bg-cyan-100 text-cyan-800",
  "Node.JS": "bg-emerald-100 text-emerald-700",
};

/** A group's level; renders nothing when the group has none. */
export function LevelBadge({ level }: { level: string | null }) {
  if (!level) return null;
  return <span className={`badge ${LEVEL_TONES[level] ?? "bg-slate-100 text-slate-600"}`}>{level}</span>;
}

export function Empty({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-sm text-slate-400">{text}</p>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function SubmitRow({ text = "Saqlash" }: { text?: string }) {
  return (
    <div className="flex justify-end pt-2">
      <button type="submit" className="btn-primary">{text}</button>
    </div>
  );
}

export function BalanceBadge({ value, label }: { value: number; label: string }) {
  const cls = value < 0 ? "bg-rose-100 text-rose-700" : value > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";
  return <span className={`badge ${cls}`}>{label}</span>;
}
