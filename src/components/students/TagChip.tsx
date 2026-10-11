import type { TagColor } from "@/lib/format";

const TONE: Record<TagColor, string> = {
  amber: "bg-accent-tint text-accent-ink",
  green: "bg-success-tint text-success",
  red: "bg-danger-tint text-danger",
  orange: "bg-warning-tint text-warning",
  grey: "bg-ink/5 text-muted",
};

export function TagChip({ name, color }: { name: string; color: string }) {
  return <span className={`badge ${TONE[color as TagColor] ?? TONE.grey}`}>{name}</span>;
}
