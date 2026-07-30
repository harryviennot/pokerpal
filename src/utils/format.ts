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

/**
 * Formats a 0-to-1 probability as a whole percentage: `0.284` becomes `28%`.
 *
 * For a figure that is glanced at rather than read — the badge printed on a hand
 * during a run-out, where a decimal place is noise and does not fit. Anywhere a
 * number is being compared, use `formatPercent` and keep the decimal.
 */
export function formatPercentWhole(value: number): string {
  const clamped = Math.min(1, Math.max(0, value));

  return `${Math.round(clamped * 100)}%`;
}

/** Formats a multiplier such as a stack-to-pot ratio: 2.5 becomes `2.5x`. */
export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(1)}x`;
}

/**
 * Formats a duration as `m:ss`, the way a tournament clock reads.
 *
 * Minutes are unpadded and unbounded, so a three-hour session shows `180:00`
 * rather than rolling over into hours nobody is counting. A negative or
 * non-finite duration reads as `0:00`: a clock on screen never runs backwards.
 *
 * @param ms milliseconds.
 */
export function formatClock(ms: number): string {
  const seconds = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1_000)) : 0;

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats an epoch-ms timestamp as `Jul 29, 14:32` in the device's timezone. */
export function formatWhen(timestamp: number): string {
  const date = new Date(timestamp);
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getHours()}:${minutes}`;
}
