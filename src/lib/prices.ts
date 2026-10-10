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
