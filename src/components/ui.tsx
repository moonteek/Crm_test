import Link from "next/link";
import { dotCounts } from "@/lib/dots";

export function PageHeader({
  title, subtitle, eyebrow, children,
}: { title: string; subtitle?: string; eyebrow?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="label-mono mb-1.5">{eyebrow}</p>}
        <h1 className="truncate text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const TONES = {
  brand: "text-ink",
  green: "text-success",
  amber: "text-warning",
  rose: "text-danger",
};

/** A key number. `hero` makes it the page's one highlighted figure. */
export function StatCard({
  label, value, icon, tone = "brand", href, hero = false,
}: {
  label: string; value: string | number; icon: React.ReactNode; tone?: keyof typeof TONES; href?: string; hero?: boolean;
}) {
  const body = (
    <div
      className={`press flex h-full flex-col justify-between gap-4 rounded-[14px] border p-4 md:p-5 ${
        hero ? "border-transparent bg-hero" : "border-line bg-surface hover:border-line-strong"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`label-mono ${hero ? "text-hero-label" : ""}`}>{label}</p>
        <span className={`[&>svg]:h-[18px] [&>svg]:w-[18px] ${hero ? "text-hero-ink" : TONES[tone]}`}>{icon}</span>
      </div>
      <p className={`truncate font-dot text-[34px] leading-none font-black md:text-[40px] ${hero ? "text-hero-ink" : "text-ink"}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

/** Pill switcher between a few views of a page, each a link. */
export function Segmented({ options }: { options: { href: string; label: string; active: boolean }[] }) {
  return (
    <div className="flex gap-0.5 rounded-full border border-line bg-surface p-0.5">
      {options.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.active ? "page" : undefined}
          className={`press rounded-full px-3.5 py-1.5 text-sm font-medium ${o.active ? "bg-nav-active text-nav-active-ink" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

/** Glyph-style row of dots: `value` of `max` lit in amber. */
export function DotMeter({ value, max, size = "sm", label }: { value: number; max: number; size?: "sm" | "md"; label?: string }) {
  const { total, filled } = dotCounts(value, max);
  const dot = size === "md" ? "h-2 w-2" : "h-1.5 w-1.5";
  return (
    <span className="inline-flex items-center gap-[3px]" role="img" aria-label={label ?? `${value} / ${max}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={`${dot} rounded-full ${i < filled ? "bg-accent" : "bg-line-strong"}`} />
      ))}
    </span>
  );
}

/** A group's level as an outline pill; renders nothing when the group has none. */
export function LevelBadge({ level }: { level: string | null }) {
  if (!level) return null;
  return (
    <span className="badge border border-line-strong text-ink">
      <i className="h-1.5 w-1.5 rounded-full bg-accent" />
      {level}
    </span>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <DotMeter value={0} max={5} />
      <p className="text-sm text-faint">{text}</p>
    </div>
  );
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
  const cls = value < 0 ? "bg-danger-tint text-danger" : value > 0 ? "bg-success-tint text-success" : "bg-ink/5 text-muted";
  return <span className={`badge ${cls}`}>{label}</span>;
}
