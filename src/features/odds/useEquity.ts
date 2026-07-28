import { useEffect, useMemo, useState } from 'react';

import {
  createRng,
  enumerateEquity,
  InvalidEquityRequestError,
  presetRange,
  runoutCount,
  simulateEquity,
  type Card,
  type EquityResult,
  type OpponentSpec,
  type RangePreset,
} from '@/engine';

/** Total samples for a converged answer. The PRD asks for 10,000 or more. */
const TOTAL_ITERATIONS = 20_000;

/**
 * Samples per frame. Small enough that a chunk costs a couple of milliseconds
 * even on a mid-range phone, so the UI keeps painting while the figure converges.
 */
const CHUNK = 2_000;

/** Above this many runouts, enumerating on the JS thread would stutter. */
const MAX_EXACT_RUNOUTS = 25_000;

/** Fixed seed: the same inputs must always produce the same reading. */
const SEED = 20260728;

export type EquityStatus = 'idle' | 'running' | 'done' | 'error';

export interface EquityState {
  result: EquityResult | null;
  status: EquityStatus;
  /** 0 to 1. Always 1 for an exact answer, which arrives in one step. */
  progress: number;
  error: string | null;
}

export interface UseEquityInput {
  hero: readonly [Card, Card] | null;
  board: readonly Card[];
  opponentCount: number;
  rangePreset: RangePreset | 'random';
}

const IDLE: EquityState = { result: null, status: 'idle', progress: 0, error: null };
const PENDING: EquityState = { result: null, status: 'running', progress: 0, error: null };

/** Sampled state plus the inputs it belongs to, so stale results never show. */
interface SampledState extends EquityState {
  key: string;
}

/**
 * Hero equity for the current inputs.
 *
 * Sampling runs in chunks across frames rather than one blocking call, so the
 * figure visibly converges and the UI keeps painting. Any input change cancels
 * the run in flight. An exact answer, when one is cheap enough to compute, is a
 * pure function of the inputs and is derived rather than stored.
 */
export function useEquity({
  hero,
  board,
  opponentCount,
  rangePreset,
}: UseEquityInput): EquityState {
  // Primitive key: the hero and board arrays are rebuilt every render, so
  // depending on them directly would restart the run on every keystroke.
  const key = `${hero ? hero.join(',') : ''}|${board.join(',')}|${opponentCount}|${rangePreset}`;

  const request = useMemo(
    () => (hero ? { hero, board, opponents: buildOpponents(opponentCount, rangePreset) } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const exact = useMemo(() => (request ? tryExact(request) : null), [request]);

  const [sampled, setSampled] = useState<SampledState>({ ...IDLE, key: '' });

  useEffect(() => {
    if (!request || exact) {
      return;
    }

    let cancelled = false;
    let completed = 0;
    let accumulated: EquityResult | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const step = (): void => {
      if (cancelled) {
        return;
      }

      try {
        // A fresh generator per chunk, offset by the work already done, keeps
        // the whole run reproducible without holding one across frames.
        const chunk = simulateEquity({
          ...request,
          iterations: Math.min(CHUNK, TOTAL_ITERATIONS - completed),
          rng: createRng(SEED + completed),
        });

        accumulated = accumulated ? merge(accumulated, chunk) : chunk;
        completed += chunk.iterations;

        const done = completed >= TOTAL_ITERATIONS;

        setSampled({
          key,
          result: accumulated,
          status: done ? 'done' : 'running',
          progress: completed / TOTAL_ITERATIONS,
          error: null,
        });

        if (!done) {
          timer = setTimeout(step, 0);
        }
      } catch (error) {
        setSampled({ key, result: null, status: 'error', progress: 0, error: describe(error) });
      }
    };

    timer = setTimeout(step, 0);

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [key, exact, request]);

  if (!hero) {
    return IDLE;
  }

  if (exact) {
    return exact;
  }

  // The effect for these inputs has not produced anything yet.
  return sampled.key === key ? sampled : PENDING;
}

function buildOpponents(count: number, rangePreset: RangePreset | 'random'): OpponentSpec[] {
  return Array.from({ length: count }, () =>
    rangePreset === 'random'
      ? ({ kind: 'random' } as OpponentSpec)
      : ({ kind: 'range', combos: presetRange(rangePreset) } as OpponentSpec),
  );
}

/**
 * Exact equity when every opponent hand is known and the runout space is small.
 * Returns null when sampling is the right tool, which with unknown opponents is
 * always — so in the calculator's common case this is a cheap no-op.
 */
function tryExact(request: {
  hero: readonly [Card, Card];
  board: readonly Card[];
  opponents: OpponentSpec[];
}): EquityState | null {
  const everyHandKnown = request.opponents.every((opponent) => opponent.kind === 'known');

  if (!everyHandKnown) {
    return null;
  }

  const dead = 2 + request.board.length + request.opponents.length * 2;

  if (runoutCount(request.board.length, 52 - dead) > MAX_EXACT_RUNOUTS) {
    return null;
  }

  try {
    return { result: enumerateEquity(request), status: 'done', progress: 1, error: null };
  } catch (error) {
    return { result: null, status: 'error', progress: 0, error: describe(error) };
  }
}

/** Combines two independent runs weighted by how many samples each examined. */
function merge(a: EquityResult, b: EquityResult): EquityResult {
  const total = a.iterations + b.iterations;

  if (total === 0) {
    return a;
  }

  const weighted = (left: number, right: number): number =>
    (left * a.iterations + right * b.iterations) / total;

  return {
    equity: weighted(a.equity, b.equity),
    win: weighted(a.win, b.win),
    tie: weighted(a.tie, b.tie),
    lose: weighted(a.lose, b.lose),
    iterations: total,
    exact: false,
  };
}

function describe(error: unknown): string {
  if (error instanceof InvalidEquityRequestError) {
    return error.message;
  }

  return 'Could not work out the odds for that hand.';
}
