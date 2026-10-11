import "server-only";
import type { Prisma } from "@prisma/client";
import { planPriceChange } from "./prices";
import { centreToday } from "./schedule";

type Tx = Prisma.TransactionClient;
const EPOCH = new Date(0);

/** The 1st of next month at the centre (UTC midnight) — when a price change takes effect. */
export function nextMonthStart(d = new Date()) {
  const t = centreToday(d);
  return new Date(Date.UTC(t.year, t.month, 1)); // t.month is 1-based, so this is next month
}

/** The 1st of the current month at the centre — the earliest a teacher change may start. */
export function thisMonthStart(d = new Date()) {
  const t = centreToday(d);
  return new Date(Date.UTC(t.year, t.month - 1, 1));
}

/**
 * Saves `price` as the group's price from the 1st of next month (see planPriceChange): the first change also
 * records `currentPrice` for every earlier month, a same-month re-edit replaces, setting back cancels.
 * Returns whether anything changed.
 */
export async function schedulePrice(tx: Tx, groupId: number, price: number, currentPrice: number, userId: number) {
  const from = nextMonthStart();
  const rows = await tx.groupPrice.findMany({ where: { groupId } });
  const plan = planPriceChange(rows, price, currentPrice, from);
  if (plan.action === "none") return false;
  if (plan.baseline !== null) await tx.groupPrice.create({ data: { groupId, price: plan.baseline, from: EPOCH, userId } });
  if (plan.action === "cancel") await tx.groupPrice.deleteMany({ where: { groupId, from } });
  else await tx.groupPrice.upsert({ where: { groupId_from: { groupId, from } }, create: { groupId, price, from, userId }, update: { price, userId } });
  return true;
}
