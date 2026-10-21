/** A small count on a menu item (hidden at 0), e.g. risky students nobody has called yet. */
export function NavBadge({ n, className = "" }: { n?: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={`min-w-4 rounded-full bg-danger px-1 text-center font-mono text-[10px] leading-4 font-semibold text-page ${className}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}
