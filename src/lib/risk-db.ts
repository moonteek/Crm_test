import "server-only";
import { db } from "./db";
import { parseRiskSettings, type RiskSettings } from "./risk";

const KEY = "risk";

/** The limits for "Xavfli o'quvchilar" (defaults until an admin saves them). */
export async function getRiskSettings(): Promise<RiskSettings> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  return parseRiskSettings(row?.value ?? null);
}

export async function storeRiskSettings(s: RiskSettings) {
  const value = JSON.stringify(s);
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}
