export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
}

export function currentMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return currentMonth(new Date(y, m - 1 + delta, 1));
}
