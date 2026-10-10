import { MEMBER_STATUS, type Status } from "@/lib/membership";

const TONE: Record<Status, string> = {
  TRIAL: "bg-warning-tint text-warning",
  ACTIVE: "border border-line-strong text-ink",
  FROZEN: "bg-ink/5 text-muted",
  LEFT: "text-faint",
};

const DOT: Record<Status, string> = {
  TRIAL: "bg-accent",
  ACTIVE: "bg-ink",
  FROZEN: "bg-line-strong",
  LEFT: "bg-line",
};

/** A student's status in one group. */
export function StatusBadge({ status }: { status: string }) {
  const s = (status in MEMBER_STATUS ? status : "ACTIVE") as Status;
  return (
    <span className={`badge ${TONE[s]}`}>
      <i className={`h-1.5 w-1.5 rounded-full ${DOT[s]}`} />
      {MEMBER_STATUS[s]}
    </span>
  );
}

/** Legend shown above a student list. */
export function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {(["TRIAL", "ACTIVE", "FROZEN"] as Status[]).map((s) => (
        <span key={s} className="label-mono inline-flex items-center gap-1.5">
          <i className={`h-1.5 w-1.5 rounded-full ${DOT[s]}`} />
          {MEMBER_STATUS[s]}
        </span>
      ))}
    </div>
  );
}
