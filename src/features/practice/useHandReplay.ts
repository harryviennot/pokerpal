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
  step: (delta: number) => void;
  /** Jumps to the next or previous street, or to either end of the hand. */
  stepStreet: (delta: number) => void;
  restart: () => void;
}

/**
 * Walks a hand's event log one frame at a time.
 *
 * The hook owns nothing but the cursor: the frames are derived from the log and
 * every table state the screen renders comes back out of the engine.
 */
export function useHandReplay(input: ReplayInput): HandReplay {
  const frames = useMemo(() => replayHand(input), [input]);
  const [cursor, setCursor] = useState(0);

  const last = Math.max(0, frames.length - 1);
  const index = Math.min(cursor, last);

  const step = useCallback(
    (delta: number) => {
      setCursor((current) => clamp(Math.min(current, last) + delta, last));
    },
    [last],
  );

  const stepStreet = useCallback(
    (delta: number) => {
      setCursor((current) => nextStreetIndex(frames, Math.min(current, last), delta));
    },
    [frames, last],
  );

  const restart = useCallback(() => setCursor(0), []);

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
    step,
    stepStreet,
    restart,
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
