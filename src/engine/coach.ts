/**
 * Grading a decision against the math.
 *
 * Pillar C, and the reason the rest of the engine exists in the shape it does:
 * every number this file needs — equity against modelled ranges, the price the
 * pot offered, the draws that were live, the stack-to-pot ratio — is already
 * computed by a module below it. The coach adds judgement, not arithmetic.
 *
 * Specifically it adds judgement to `recommend.ts`, which does the measuring and
 * the ranking. That split is load-bearing: the guide the player sees *before*
 * they act and the grade they get *after* come from one implementation, so the
 * two can never contradict each other in front of them.
 *
 * The unit throughout is **chips of expected value given up**, converted to big
 * blinds for the grade. That choice matters: a grade has to mean the same thing
 * at 5/10 as at 50/100, and "how many chips did that cost you" is the only
 * currency a player can act on. A fold that costs 0.1bb and a fold that costs
 * 12bb are not the same mistake even when both are technically wrong.
 *
 * The EV model is showdown-only — it asks what each line is worth if the hand
 * were checked down from here — which is honest for ranking the lines and too
 * generous about early streets. See `STREET_WEIGHT` for what is done about that
 * and what is deliberately not.
 *
 * What this file does **not** do is speak. It produces a grade, a number and a
 * terse factual reason; the plain-English layer in `src/components/coach` turns
 * those into sentences and may never invent a figure that did not come from here.
 */

import { type HandEvent, type Street } from './events';
import { applyAction, dealHand } from './hand';
import { chenScore } from './rangeModel';
import {
  lineValue,
  recommend,
  type CoachOptions,
  type DecisionFacts,
  type Recommendation,
} from './recommend';
import { playerAt, type Action, type HandState, type SeatIndex, type TableConfig } from './table';

/**
 * Re-exported so the coach still reads as one vocabulary from the outside, and
 * so every existing importer of `./coach` keeps working after the split.
 */
export { type CoachOptions, type DecisionFacts, type Recommendation };

export type Grade = 'correct' | 'marginal' | 'mistake' | 'blunder';

/**
 * The leak a decision is evidence of. Deliberately the PRD's own five
 * categories: they are the ones a player can recognise in themselves.
 */
export type Leak =
  'preflopLooseness' | 'chasingWithoutOdds' | 'missedValue' | 'overBluffing' | 'positional';

export interface DecisionReview {
  seat: SeatIndex;
  action: Action;
  /** The action the coach would have taken. */
  best: Action;
  grade: Grade;
  /** Chips of expected value given up against `best`. Never negative. */
  evLoss: number;
  /** One line, factual, numbers only from `facts`. */
  reason: string;
  leak: Leak | null;
  facts: DecisionFacts;
}

/** One state a seat faced in a played hand, paired with what they did in it. */
export interface DecisionPoint {
  state: HandState;
  action: Action;
}

/**
 * Grade thresholds, in big blinds of expected value given up.
 *
 * The bottom band is not zero: equity here is sampled, ranges are estimated, and
 * calling a decision a mistake on a tenth of a blind of modelled EV would be
 * false precision dressed up as coaching.
 */
const GRADE_BANDS: readonly { grade: Grade; upTo: number }[] = [
  { grade: 'correct', upTo: 0.25 },
  { grade: 'marginal', upTo: 1 },
  { grade: 'mistake', upTo: 4 },
  { grade: 'blunder', upTo: Infinity },
];

/**
 * How much of the final pot is still to be bet, by street.
 *
 * The EV model below is showdown-only: it asks what a call is worth if the hand
 * were checked down from here. That is the right way to *rank* the lines — it
 * favours nothing and nobody — but it badly understates what an early mistake
 * costs, because the chips a preflop error commits you to keep going in for
 * three more streets. Folding aces on the button reads as 0.8bb of showdown EV
 * and is obviously not a 0.8bb mistake.
 *
 * So severity, and only severity, is weighted by how much betting is left. The
 * ranking of actions is untouched, which matters: scaling the EV of calling
 * would bias every grade towards calling more, and a coach that encourages
 * loose calls is worse than one that under-rates aces.
 *
 * These are coarse. They are a stand-in for a real multi-street EV model, and
 * they are the first thing to replace when one exists.
 */
const STREET_WEIGHT: Record<Street, number> = {
  preflop: 4,
  flop: 2.5,
  turn: 1.5,
  river: 1,
  showdown: 1,
};

/** Below this Chen score, entering a pot voluntarily is a losing habit. */
const LOOSE_ENTRY_SCORE = 8;

/**
 * Grades one decision, in the state the table was in when it was made.
 *
 * `state` must be waiting on `state.toAct`, and `action` is what that seat did.
 *
 * The ranking is `recommend`'s, unchanged and unweighted. Only the *severity* is
 * this file's business, which is why `STREET_WEIGHT` is applied here and nowhere
 * near the lines themselves.
 */
export function reviewDecision(
  state: HandState,
  action: Action,
  options: CoachOptions,
): DecisionReview | null {
  const seat = state.toAct;
  const recommendation = seat === null ? null : recommend(state, seat, options);

  if (seat === null || !recommendation) {
    return null;
  }

  const { facts, best } = recommendation;
  const bestEv = lineValue(recommendation, best);
  const evLoss =
    Math.max(0, bestEv - lineValue(recommendation, action)) * (STREET_WEIGHT[facts.street] ?? 1);
  const bigBlind = state.blinds.bigBlind || 1;

  return {
    seat,
    action,
    best,
    grade: gradeFor(evLoss / bigBlind),
    evLoss,
    reason: describe(action, facts, evLoss),
    leak: leakFor(action, facts, evLoss, best, state, seat),
    facts,
  };
}

/**
 * Every state a seat faced in a hand that has already been played, paired with
 * the action they took, in the order they took them.
 *
 * Re-deals from the shuffled deck the hand recorded in its own opening event and
 * replays the actions through the real engine, so each state is exactly the one
 * the player faced. Nothing is reconstructed by hand, and nothing can drift from
 * what actually happened.
 *
 * **The order is load-bearing.** `reviewDecision` draws from the `Rng` it is
 * handed, so the verdict for a decision depends on how many decisions were
 * graded before it. A caller grading these one at a time — the store does, one
 * per event-loop tick, to keep a 1 500-sample Monte Carlo off the frame budget —
 * reproduces `reviewHand` exactly by walking this array front to back with one
 * `Rng` instance, and only that way. Every point is returned, including ones the
 * coach will decline to grade; `reviewDecision` returning null costs no samples.
 */
export function decisionPoints(
  config: TableConfig,
  events: readonly HandEvent[],
  seat: SeatIndex,
): readonly DecisionPoint[] {
  const opening = events.find((event) => event.type === 'handStart');

  if (!opening || opening.type !== 'handStart') {
    return [];
  }

  const points: DecisionPoint[] = [];
  let state = dealHand(config, opening.deck);

  for (const event of events) {
    if (event.type !== 'actionTaken') {
      continue;
    }

    const action = toAction(event.action);

    if (event.seat === seat) {
      points.push({ state, action });
    }

    state = applyAction(state, action);
  }

  return points;
}

/**
 * Grades every decision a seat made in a hand that has already been played.
 *
 * The whole-hand path: walks `decisionPoints` front to back on the one `Rng` in
 * `options`, which is the order a chunked caller must reproduce to reach the
 * same verdicts. Points the coach cannot grade are dropped.
 */
export function reviewHand(
  config: TableConfig,
  events: readonly HandEvent[],
  seat: SeatIndex,
  options: CoachOptions,
): DecisionReview[] {
  return decisionPoints(config, events, seat)
    .map((point) => reviewDecision(point.state, point.action, options))
    .filter((review): review is DecisionReview => review !== null);
}

function gradeFor(lossInBigBlinds: number): Grade {
  return GRADE_BANDS.find((band) => lossInBigBlinds <= band.upTo)?.grade ?? 'blunder';
}

/**
 * One line of arithmetic, in the terms a player reads at the table.
 *
 * Percentages of the pot rather than raw chips, because "called 40% of pot with
 * 18% equity" transfers to the next table and "called 240" does not.
 */
function describe(action: Action, facts: DecisionFacts, evLoss: number): string {
  const equity = percent(facts.equity);
  const price = facts.pot > 0 ? Math.round((facts.toCall / facts.pot) * 100) : 0;
  const draw = facts.outs > 0 ? `${facts.outs} outs` : 'no draw';

  switch (action.type) {
    case 'fold':
      return facts.toCall > 0
        ? `Folded to ${price}% of pot holding ${equity} equity, needing ${percent(facts.requiredEquity)}.`
        : `Folded with nothing to call.`;
    case 'check':
      return `Checked with ${equity} equity and ${draw}.`;
    case 'call':
      return `Called ${price}% of pot with ${equity} equity and ${draw}, needing ${percent(facts.requiredEquity)}.`;
    case 'bet':
    case 'raise':
      return `${action.type === 'bet' ? 'Bet' : 'Raised'} with ${equity} equity and ${draw}${
        evLoss > 0 ? ', against a range that has it beaten' : ''
      }.`;
  }
}

/** The habit a bad decision is evidence of, or null when it was not bad. */
function leakFor(
  action: Action,
  facts: DecisionFacts,
  evLoss: number,
  best: Action,
  state: HandState,
  seat: SeatIndex,
): Leak | null {
  if (gradeFor(evLoss / (state.blinds.bigBlind || 1)) === 'correct') {
    return null;
  }

  const hole = playerAt(state, seat).holeCards;

  if (
    facts.street === 'preflop' &&
    action.type !== 'fold' &&
    hole &&
    chenScore(hole) < LOOSE_ENTRY_SCORE
  ) {
    return 'preflopLooseness';
  }

  if (action.type === 'call' && facts.equity < facts.requiredEquity) {
    return 'chasingWithoutOdds';
  }

  if (action.type === 'check' && (best.type === 'bet' || best.type === 'raise')) {
    return 'missedValue';
  }

  if ((action.type === 'bet' || action.type === 'raise') && facts.equity < 0.5) {
    return 'overBluffing';
  }

  // Acting into several players still to speak, from a spot that offered no
  // information, is the shape a positional error takes.
  return facts.playersBehind > 0 ? 'positional' : null;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** A logged action carries the chips it moved; grading only needs the shape. */
function toAction(logged: { type: string; to?: number }): Action {
  switch (logged.type) {
    case 'bet':
      return { type: 'bet', to: logged.to ?? 0 };
    case 'raise':
      return { type: 'raise', to: logged.to ?? 0 };
    case 'call':
      return { type: 'call' };
    case 'check':
      return { type: 'check' };
    default:
      return { type: 'fold' };
  }
}
