import { useEffect, useMemo, useState } from 'react';

import {
  CARD_COUNT,
  createRng,
  enumerateEquity,
  runoutCount,
  simulateEquity,
  type EquityRequest,
} from '@/engine';

/**
 * Monte Carlo that never blocks a frame.
 *
 * The pattern is the calculator's (`features/odds/useEquity`): sample in small
 * chunks on a zero-delay timer so the JS thread keeps painting between them, and
 * throw the run away the moment the inputs change. Two things make it worth its
 * own hook on the felt. The table asks several questions at once — one per hand
 * in an all-in run-out — and it asks them mid-hand, where the frame budget is
 * already being spent on cards and chips moving. It also asks on boards where the
 * unknown space is small enough to walk exactly, and an exact answer costs less
 * than a sampled one there, so that path is tried first every time.
 *
 * @param key everything that changes the answer, as a primitive string.
 * @param requests one per answer wanted, or null when there is nothing to work
 *   out. Rebuilt by the caller on every render; `key` is what pins it.
 */
export function useChunkedEquity(
  key: string,
  requests: readonly EquityRequest[] | null,
): readonly (number | null)[] {
  // Pinned to `key`: the caller rebuilds the array every render, and depending on
  // its identity would restart the run before it ever converged.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pinned = useMemo(() => requests, [key]);
  const exact = useMemo(() => (pinned ? tryExact(pinned) : null), [pinned]);
  const [sampled, setSampled] = useState<Sampled>(NOTHING);

  useEffect(() => {
    if (!pinned || exact) {
      return;
    }

    let cancelled = false;
    let completed = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const shares = pinned.map(() => 0);

    const step = (): void => {
      if (cancelled) {
        return;
      }

      const iterations = Math.min(CHUNK, TOTAL_ITERATIONS - completed);

      for (const [index, request] of pinned.entries()) {
        // A fresh generator per chunk and per hand, offset by the work already
        // done, keeps the whole run reproducible without holding one across
        // frames — and keeps two hands in the same run-out off one stream, where
        // they would sample correlated boards.
        const chunk = simulateEquity({
          ...request,
          iterations,
          rng: createRng(SEED + completed + index * STREAM_OFFSET),
        });

        shares[index] = (shares[index] ?? 0) + chunk.equity * chunk.iterations;
      }

      completed += iterations;
      setSampled({ key, equities: shares.map((share) => share / completed) });

      if (completed < TOTAL_ITERATIONS) {
        timer = setTimeout(step, 0);
      }
    };

    timer = setTimeout(step, 0);

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [key, exact, pinned]);

  if (!pinned) {
    return NONE;
  }

  if (exact) {
    return exact;
  }

  // The run for these inputs has not produced anything yet: no reading rather
  // than the last spot's, which would be a badge that is quietly wrong.
  return sampled.key === key ? sampled.equities : pinned.map(() => null);
}

/** Samples for a figure printed to the whole percent. Beyond this it stops moving. */
const TOTAL_ITERATIONS = 4_000;

/** Samples per frame, small enough that a chunk costs a couple of milliseconds. */
const CHUNK = 500;

/**
 * Above this many runouts, enumerating on the JS thread would stutter. The same
 * threshold `equity()` uses; it is not exported, and duplicating the number is
 * better than importing the engine's internals.
 */
const MAX_EXACT_RUNOUTS = 25_000;

/** Fixed seed: the same spot must always read the same. */
const SEED = 20260729;

/** Prime-ish gap between the streams two hands in one run-out sample from. */
const STREAM_OFFSET = 7_919;

const HOLE_CARDS = 2;

/** Sampled equities plus the inputs they belong to, so a stale answer never shows. */
interface Sampled {
  key: string;
  equities: readonly number[];
}

const NOTHING: Sampled = { key: '', equities: [] };

const NONE: readonly (number | null)[] = [];

/**
 * Exact equity for every request, or null when sampling is the right tool.
 *
 * All-or-nothing on purpose: mixing an enumerated answer with a sampled one in
 * the same run-out would show badges that do not add up to a hundred.
 */
function tryExact(requests: readonly EquityRequest[]): readonly number[] | null {
  for (const request of requests) {
    if (!request.opponents.every((opponent) => opponent.kind === 'known')) {
      return null;
    }

    const board = request.board ?? [];
    const dead = HOLE_CARDS + board.length + request.opponents.length * HOLE_CARDS;

    if (runoutCount(board.length, CARD_COUNT - dead) > MAX_EXACT_RUNOUTS) {
      return null;
    }
  }

  try {
    return requests.map((request) => enumerateEquity(request).equity);
  } catch {
    // A request the engine rejects means there is nothing to say, not a broken
    // screen: these figures are decoration on a hand that is already playing.
    return null;
  }
}
