/**
 * `computeLiveAdvice`, off the frame budget.
 *
 * Advice recomputes only when the observation changes — a locked board card, a
 * fresh pot entry — never per camera frame. The Monte Carlo runs on a deferred
 * tick so the tap that triggered it paints first, and a result only shows if
 * its inputs are still the current ones.
 */

import { useEffect, useState } from 'react';

import { computeLiveAdvice, type LiveAdvice } from './liveAdvice';
import { type LiveObservation } from './liveHandState';

interface Computed {
  key: string;
  advice: LiveAdvice | null;
}

const NOTHING: Computed = { key: '', advice: null };

/** The advice for `obs`, or null while there is none or it is still running. */
export function useLiveAdvice(obs: LiveObservation | null): LiveAdvice | null {
  const key = obs ? keyOf(obs) : null;
  const [computed, setComputed] = useState<Computed>(NOTHING);

  useEffect(() => {
    if (!obs || key === null) {
      return;
    }

    const timer = setTimeout(() => {
      setComputed({ key, advice: computeLiveAdvice(obs) });
    }, 0);

    return () => clearTimeout(timer);
    // `obs` is rebuilt every render; `key` carries everything that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (key === null) {
    return null;
  }

  return computed.key === key ? computed.advice : null;
}

function keyOf(obs: LiveObservation): string {
  return [
    ...obs.heroCards,
    ...obs.board,
    obs.opponents,
    obs.potBb,
    obs.toCallBb,
    obs.heroStackBb,
  ].join('|');
}
