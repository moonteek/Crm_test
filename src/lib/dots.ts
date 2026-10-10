const MAX_DOTS = 12;

/** How many dots a Glyph-style meter draws, and how many are lit, for `value` out of `max`. */
export function dotCounts(value: number, max: number) {
  if (!(max > 0)) return { total: 0, filled: 0 };
  const total = Math.min(max, MAX_DOTS);
  const filled = Math.round((Math.min(Math.max(value, 0), max) / max) * total);
  return { total, filled };
}
