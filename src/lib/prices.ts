// Monthly prices with history: a change starts on the 1st of a month and earlier months keep their price.

export type PriceRow = { price: number; from: Date };

/** The price in force for a month (0-based); with no history, the current price. */
export function priceAt(history: PriceRow[], fallback: number, year: number, month: number) {
  const start = Date.UTC(year, month, 1);
  let best: PriceRow | null = null;
  for (const row of history) {
    if (row.from.getTime() <= start && (!best || row.from > best.from)) best = row;
  }
  return best ? best.price : fallback;
}

/** A scheduled change that has not started yet (shown as "1-noyabrdan: …"). */
export function upcomingPrice(history: PriceRow[], now: Date): PriceRow | null {
  const future = history.filter((r) => r.from > now).sort((a, b) => a.from.getTime() - b.from.getTime());
  return future[0] ?? null;
}

/**
 * What saving `price` (from the month starting `from`) does to a group's history: record the old price as the
 * baseline for earlier months (first change only), set the scheduled row, cancel it (back to the previous
 * price), or nothing.
 */
export function planPriceChange(history: PriceRow[], price: number, currentPrice: number, from: Date): { baseline: number | null; action: "set" | "cancel" | "none" } {
  const next = priceAt(history, currentPrice, from.getUTCFullYear(), from.getUTCMonth());
  if (price === next) return { baseline: null, action: "none" };
  const prev = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1));
  const before = priceAt(history.filter((r) => r.from < from), currentPrice, prev.getUTCFullYear(), prev.getUTCMonth());
  if (price === before) return { baseline: null, action: "cancel" };
  return { baseline: history.length ? null : currentPrice, action: "set" };
}

/**
 * An edited group's price: `own` is what the group stores (null = follows the course price), `target` what it should
 * cost. A section's own price applies only when the group moves into that section — a rename or a teacher change
 * never reprices a group that follows the course.
 */
export function editedGroupPrice(p: { formPrice: number | null; sectionChanged: boolean; sectionPrice: number | null; coursePrice: number }) {
  const own = p.formPrice ?? (p.sectionChanged ? p.sectionPrice : null);
  return { own, target: own ?? p.coursePrice };
}
