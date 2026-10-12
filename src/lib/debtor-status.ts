export type DebtorStatus = "all" | "active" | "left";
export const DEBTOR_STATUSES: Record<DebtorStatus, string> = { all: "Hammasi", active: "Faol", left: "Chiqib ketgan" };

/** Faol = still in at least one group; Chiqib ketgan = in none (but still owes). */
export function debtorMatches(s: { groups: { leftAt: Date | null }[] }, status: DebtorStatus) {
  if (status === "all") return true;
  const current = s.groups.some((g) => g.leftAt === null);
  return status === "active" ? current : !current;
}
