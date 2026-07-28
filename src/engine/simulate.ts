/**
 * The measuring stick for bots.
 *
 * The PRD does not accept a bot because it looks reasonable; it accepts one that
 * beats the tier below it over a long seeded run. This plays that run: every
 * seat gets a policy, hands are dealt until the count is reached, and the chips
 * are counted in big blinds per 100 hands — the unit poker actually uses, and
 * the only one that compares runs of different lengths.
 *
 * Busted seats are rebought to their starting stack so the sample keeps its
 * table size. Measuring win rate and measuring who survives are different
 * questions, and mixing them makes a short-stacked seat look like a bad bot.
 */

import { legalActions } from './betting';
import { type BotPolicy } from './bots';
import { applyAction } from './hand';
import { createRng } from './rng';
import { finishHand, startNextHand, startSession, type BlindLevel } from './session';
import { InvalidTableError, type SeatIndex } from './table';

export interface MatchConfig {
  /** One policy per seat, in seat order. Two to nine of them. */
  policies: readonly BotPolicy[];
  hands: number;
  startingStack: number;
  blinds: BlindLevel;
  seed: number;
}

export interface MatchResult {
  hands: number;
  /** Net chips per seat, in seat order. Always sums to zero. */
  net: readonly number[];
  /** Big blinds won per 100 hands, per seat. The standard yardstick. */
  bbPer100: readonly number[];
  /** Hands each seat put chips in voluntarily, past the blinds. Their VPIP count. */
  voluntary: readonly number[];
  /** Bets and raises each seat made. Their aggression, counted rather than assumed. */
  raises: readonly number[];
}

const MAX_ACTIONS_PER_HAND = 500;

/**
 * Plays `hands` hands with the given policies and counts the chips.
 *
 * @throws {InvalidTableError} when the table cannot play.
 */
export function simulateMatch(config: MatchConfig): MatchResult {
  if (config.hands < 1) {
    throw new InvalidTableError(`A match needs at least one hand, got ${config.hands}.`);
  }

  const seats = config.policies.map((_, index) => ({
    id: `Seat ${index}`,
    stack: config.startingStack,
  }));

  let session = startSession({
    seats,
    style: 'cash',
    levels: [config.blinds],
    rebuyTo: config.startingStack,
    seed: config.seed,
  });

  const net = seats.map(() => 0);
  const voluntary = seats.map(() => 0);
  const raises = seats.map(() => 0);
  // One stream for every bot decision in the match, so the whole run replays
  // from `config.seed` alone.
  const rng = createRng(config.seed ^ 0x5bf03635);

  for (let played = 0; played < config.hands; played++) {
    const dealt = startNextHand(session);
    let hand = dealt.hand;

    for (let step = 0; step < MAX_ACTIONS_PER_HAND && !hand.complete; step++) {
      const seat = hand.toAct;

      if (seat === null) {
        break;
      }

      const legal = legalActions(hand);

      if (legal.length === 0) {
        break;
      }

      const policy = config.policies[seat];

      if (!policy) {
        throw new InvalidTableError(`No policy for seat ${seat}.`);
      }

      const action = policy(hand, legal, rng);

      count(action.type, seat, hand.currentBet, voluntary, raises);
      hand = applyAction(hand, action);
    }

    session = finishHand(dealt.session, hand);

    const record = session.history[session.history.length - 1];

    record?.results.forEach((result, seat) => {
      net[seat] = (net[seat] ?? 0) + result;
    });
  }

  const perHundred = 100 / config.hands / config.blinds.bigBlind;

  return {
    hands: config.hands,
    net,
    bbPer100: net.map((chips) => chips * perHundred),
    voluntary,
    raises,
  };
}

/**
 * Tallies the two numbers every poker tracker leads with.
 *
 * A call of zero is a check and not voluntary; a call facing the big blind is.
 * This counts actions rather than hands, which overstates VPIP for a seat that
 * calls twice in one hand — good enough to rank three archetypes against each
 * other, and not good enough to publish.
 */
function count(
  type: string,
  seat: SeatIndex,
  currentBet: number,
  voluntary: number[],
  raises: number[],
): void {
  if (type === 'bet' || type === 'raise') {
    raises[seat] = (raises[seat] ?? 0) + 1;
    voluntary[seat] = (voluntary[seat] ?? 0) + 1;

    return;
  }

  if (type === 'call' && currentBet > 0) {
    voluntary[seat] = (voluntary[seat] ?? 0) + 1;
  }
}
