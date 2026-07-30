/**
 * The only place in the game feature that owns a timer.
 *
 * Pacing means several delayed callbacks are in flight at any moment: a bot
 * thinking, a street being revealed, a decision clock ticking, the next hand
 * coming. Every one of them is a chance to fire into a table that has moved on —
 * the player left, they acted before the clock ran out, a new session was
 * started — and a bot acting into the wrong hand is the bug that race produces.
 *
 * So cancellation is a generation counter, not a hunt for handles: a callback
 * captures the generation it was scheduled in and does nothing if `cancelAll`
 * has run since. Clearing the underlying timers is the optimisation; the
 * generation check is what makes cancel-then-fire impossible.
 *
 * Timers and the clock are injected, so tests drive a whole session from a stub
 * clock and nothing above this file ever names `setTimeout`.
 */

/**
 * The platform primitives the scheduler stands on.
 *
 * `Handle` is whatever `setTimeoutFn` hands back; the scheduler only ever gives
 * it to `clearTimeoutFn`, so a stub can use numbers, objects, or nothing at all.
 */
export interface GameTimers<Handle> {
  setTimeoutFn: (fn: () => void, delayMs: number) => Handle;
  clearTimeoutFn: (handle: Handle) => void;
  /** Epoch ms. The decision clock and the blind ladder are both wall-clock. */
  now: () => number;
}

export interface GameScheduler {
  /** Runs `fn` after `delayMs`, unless the generation moves on first. */
  schedule(delayMs: number, fn: () => void): void;
  /** Drops every pending callback and invalidates the ones already firing. */
  cancelAll(): void;
  now(): number;
  /** Bumped by every `cancelAll`. Callbacks from an earlier one never run. */
  generation(): number;
  /** Callbacks still waiting. Tests assert this reaches zero. */
  pending(): number;
}

/** `setTimeout` and the wall clock. What the app runs on. */
export function realTimers(): GameTimers<ReturnType<typeof setTimeout>> {
  return {
    setTimeoutFn: (fn, delayMs) => setTimeout(fn, delayMs),
    clearTimeoutFn: (handle) => clearTimeout(handle),
    now: () => Date.now(),
  };
}

export function createGameScheduler<Handle>(timers: GameTimers<Handle>): GameScheduler {
  let generation = 0;
  // Boxed handles: a stub clock may run the callback before `setTimeoutFn` has
  // returned, so the entry has to exist before the handle does.
  const waiting = new Set<{ handle: Handle | null }>();

  return {
    schedule(delayMs, fn) {
      const scheduledIn = generation;
      const entry: { handle: Handle | null } = { handle: null };
      let fired = false;

      const run = (): void => {
        fired = true;
        waiting.delete(entry);

        if (scheduledIn !== generation) {
          return;
        }

        fn();
      };

      entry.handle = timers.setTimeoutFn(run, delayMs);

      if (!fired) {
        waiting.add(entry);
      }
    },

    cancelAll() {
      generation++;

      for (const entry of waiting) {
        if (entry.handle !== null) {
          timers.clearTimeoutFn(entry.handle);
        }
      }

      waiting.clear();
    },

    now: () => timers.now(),

    generation: () => generation,

    pending: () => waiting.size,
  };
}
