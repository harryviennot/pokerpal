/** Narrow no-break space — groups digits without a full word gap and never wraps. */
export const THIN_SPACE = '\u202F';

/**
 * Formats a 0-to-1 probability as a percentage string with one decimal.
 * Values outside 0 to 1 are clamped, since equity is never negative or over 100%.
 */
export function formatPercent(value: number): string {
  const clamped = Math.min(1, Math.max(0, value));

  return `${(clamped * 100).toFixed(1)}%`;
}

/** Formats a chip count with thin-space digit grouping: 12500 becomes `12 500`. */
export function formatChips(chips: number): string {
  const rounded = Math.round(chips);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);

  return `${sign}${grouped}`;
}

/** Formats a multiplier such as a stack-to-pot ratio: 2.5 becomes `2.5x`. */
export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(1)}x`;
}
