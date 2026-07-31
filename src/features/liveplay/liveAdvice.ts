/**
 * The recommendation for a live spot, computed the way the Coach grades one.
 *
 * PRD A4 Tier 2: live advice must use the same rubric as post-hand review, so
 * this calls `reviewDecision` itself — same EV model, same ranges, same
 * thresholds — and reads the `best` line out of the verdict. The action passed
 * in is a placeholder (the coach computes `best` regardless); its grade is
 * discarded.
 *
 * Deterministic: the RNG is seeded from the observation, so the same spot
 * always returns the same advice. A banner that flip-flops on resample noise
 * would be worse than no banner.
 */

import { createRng, reviewDecision, type Action, type DecisionFacts } from '@/engine';

import { buildLiveHandState, type LiveObservation } from './liveHandState';

export interface LiveAdvice {
  /** The sized action the coach would take. */
  best: Action;
  /** One line of arithmetic behind it, numbers only from `facts`. */
  reason: string;
  facts: DecisionFacts;
}

/** Samples per advice. One post-hand grading tick's worth: cheap enough to
 * run on a state change, accurate enough to trust. */
const ADVICE_ITERATIONS = 1_500;

/** The advice for this observation, or null when it is not a gradable spot. */
export function computeLiveAdvice(obs: LiveObservation): LiveAdvice | null {
  const state = buildLiveHandState(obs);

  if (!state) {
    return null;
  }

  // Fold/check is always a legal line; which one is irrelevant — only `best`
  // and `facts` are read from the verdict.
  const placeholder: Action = obs.toCallBb > 0 ? { type: 'fold' } : { type: 'check' };
  const review = reviewDecision(state, placeholder, {
    rng: createRng(seedOf(obs)),
    iterations: ADVICE_ITERATIONS,
  });

  if (!review) {
    return null;
  }

  return { best: review.best, reason: reasonFor(review.best, review.facts), facts: review.facts };
}

/** A stable seed from everything that changes the answer. */
export function seedOf(obs: LiveObservation): number {
  const key = [
    ...obs.heroCards,
    ...obs.board,
    obs.opponents,
    obs.potBb,
    obs.toCallBb,
    obs.heroStackBb,
  ].join('|');

  // FNV-1a, 32-bit: tiny, deterministic, spreads nearby keys apart.
  let hash = 0x811c9dc5;

  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/** Why the recommended line wins, phrased forward — the coach's `reason`
 * describes an action already taken, which a recommendation is not. */
function reasonFor(best: Action, facts: DecisionFacts): string {
  const equity = percent(facts.equity);
  const required = percent(facts.requiredEquity);
  const draw = facts.outs > 0 ? ` with ${facts.outs} outs` : '';

  switch (best.type) {
    case 'fold':
      return `The call needs ${required} equity and you have ${equity}${draw}.`;
    case 'call':
      return `Your ${equity} equity${draw} beats the ${required} the price demands.`;
    case 'check':
      return `${equity} equity${draw}; the check is free.`;
    case 'bet':
    case 'raise':
      return `${equity} equity against the field; make them pay to see the next card.`;
  }
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
