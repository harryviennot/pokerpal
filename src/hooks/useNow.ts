import { useEffect, useState } from 'react';

/** How often the clock is re-read by default. A second, because seconds are shown. */
const TICK_MS = 1_000;

/**
 * The wall clock, re-read on an interval.
 *
 * One interval per caller, cleared on unmount. Everything that counts on the
 * game screen — the session clock, the blind level, the hero's decision clock —
 * is a stored epoch plus this, so no ticking value ever lands in a store and
 * wakes every subscriber once a second.
 *
 * @param intervalMs how often to re-read. Ask for less than a second only where
 *   something moves smoothly, like a countdown bar.
 */
export function useNow(intervalMs: number = TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
