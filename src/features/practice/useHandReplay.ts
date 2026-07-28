import { useCallback, useMemo, useState } from 'react';

import { replayHand, type ReplayFrame, type ReplayInput, type TableSnapshot } from '@/engine';

export interface HandReplay {
  frames: readonly ReplayFrame[];
  /** Position in the log, always inside `frames`. */
  index: number;
  frame: ReplayFrame;
  snapshot: TableSnapshot;
  atStart: boolean;
  atEnd: boolean;
  /** True while the cursor is tracking the end of a log that is still growing. */
  following: boolean;
  step: (delta: number) => void;
  /** Jumps to the next or previous street, or to either end of the hand. */
  stepStreet: (delta: number) => void;
  restart: () => void;
  /** Returns the cursor to the end and pins it there. */
  follow: () => void;
}

export interface HandReplayOptions {
  /**
   * Track the end of the log rather than starting at the top. A hand being
   * played is a log that grows, and the table wants its newest frame; stepping
   * back drops out of it, and `follow()` returns.
   */
  follow?: boolean;
}

/**
 * Walks a hand's event log one frame at a time.
 *
 * The hook owns nothing but the cursor: the frames are derived from the log and
 * every table state the screen renders comes back out of the engine.
 */
export function useHandReplay(input: ReplayInput, options: HandReplayOptions = {}): HandReplay {
  const frames = useMemo(() => replayHand(input), [input]);
  // Null is the cursor tracking the end of the log. Holding it as an absence
  // rather than a number is what lets a live hand grow under the table without
  // the hook chasing the length in an effect.
  const [cursor, setCursor] = useState<number | null>(options.follow ? null : 0);

  const last = Math.max(0, frames.length - 1);
  const index = cursor === null ? last : Math.min(cursor, last);

  const step = useCallback(
    (delta: number) => {
      setCursor((current) =>
        clamp((current === null ? last : Math.min(current, last)) + delta, last),
      );
    },
    [last],
  );

  const stepStreet = useCallback(
    (delta: number) => {
      setCursor((current) =>
        nextStreetIndex(frames, current === null ? last : Math.min(current, last), delta),
      );
    },
    [frames, last],
  );

  const restart = useCallback(() => setCursor(0), []);
  const follow = useCallback(() => setCursor(null), []);

  // `frames` is never empty in practice — a hand always logs a `handStart` —
  // but the fallback keeps the screen renderable rather than throwing at it.
  const frame = frames[index] ?? EMPTY_FRAME;

  return {
    frames,
    index,
    frame,
    snapshot: frame.snapshot,
    atStart: index === 0,
    atEnd: index === last,
    following: cursor === null,
    step,
    stepStreet,
    restart,
    follow,
  };
}

function clamp(value: number, last: number): number {
  return Math.min(Math.max(value, 0), last);
}

/** The frame that opens the next street, or the far end of the hand when there is none. */
function nextStreetIndex(frames: readonly ReplayFrame[], from: number, delta: number): number {
  const last = Math.max(0, frames.length - 1);

  for (let index = from + delta; index > 0 && index < last; index += delta) {
    if (frames[index]?.event.type === 'streetDealt') {
      return index;
    }
  }

  return delta > 0 ? last : 0;
}

const EMPTY_FRAME: ReplayFrame = {
  index: 0,
  event: { type: 'handEnd', street: 'preflop' },
  description: '',
  snapshot: {
    handNumber: 0,
    button: 0,
    street: 'preflop',
    board: [],
    seats: [],
    pot: 0,
    actor: null,
    complete: true,
  },
};
