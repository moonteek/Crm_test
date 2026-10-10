import "server-only";
import type { Prisma } from "@prisma/client";
import { priceAt } from "./prices";
import { centreToday } from "./schedule";

type Tx = Prisma.TransactionClient;
const EPOCH = new Date(0);

/** The 1st of next month at the centre (UTC midnight) — when a price change takes effect. */
export function nextMonthStart(d = new Date()) {
  const t = centreToday(d);
  return new Date(Date.UTC(t.year, t.month, 1)); // t.month is 1-based, so this is next month
}

/** What the group will charge next month as things stand (history first, then its current price). */
export async function priceNextMonth(tx: Tx, groupId: number, currentPrice: number) {
  const from = nextMonthStart();
  const rows = await tx.groupPrice.findMany({ where: { groupId } });
  return priceAt(rows, currentPrice, from.getUTCFullYear(), from.getUTCMonth());
}

/**
 * Schedules `price` from the 1st of next month. The first change also records `currentPrice` as the price of
 * every earlier month, so past charges never move. Setting the price back to what the month before charges
 * cancels the scheduled change.
 */
export async function schedulePrice(tx: Tx, groupId: number, price: number, currentPrice: number, userId: number) {
  const from = nextMonthStart();
  const rows = await tx.groupPrice.findMany({ where: { groupId } });
  if (!rows.length) await tx.groupPrice.create({ data: { groupId, price: currentPrice, from: EPOCH, userId } });
  const prev = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1));
  const before = priceAt(rows.filter((r) => r.from < from), currentPrice, prev.getUTCFullYear(), prev.getUTCMonth());
  if (price === before) {
    await tx.groupPrice.deleteMany({ where: { groupId, from } });
    return;
  }
  await tx.groupPrice.upsert({
    where: { groupId_from: { groupId, from } },
    create: { groupId, price, from, userId },
    update: { price, userId },
  });
}
