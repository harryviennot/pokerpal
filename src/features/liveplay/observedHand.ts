/**
 * An observed hand, dressed for the archive.
 *
 * PRD A4: every hand Live Assist watches becomes a saved hand history. The
 * log is honest about what was actually seen — hero's cards, the board as it
 * locked, nothing else. No opponent holdings, no invented actions, a hero net
 * of zero; in the replayer the villains simply never reveal.
 *
 * The deck is synthesized deterministically from the seed with the observed
 * cards pinned into their deal positions, so the record has the same shape as
 * a played hand and replays through the same code.
 */

import {
  allCards,
  createRng,
  shuffle,
  type Card,
  type DecisionReview,
  type HandEvent,
  type SeatIndex,
} from '@/engine';
import { type ArchivedHand } from '@/services/handHistory';

import { LIVE_BIG_BLIND, streetOfBoard } from './liveHandState';

export interface ObservedHandInput {
  handNumber: number;
  heroCards: readonly [Card, Card];
  /** The locked board: 0, 3, 4 or 5 cards. A partial flop is dropped. */
  board: readonly Card[];
  opponents: number;
  heroStackBb: number;
  /** The advice issued during the hand, as coach reviews, in order. */
  reviews: readonly DecisionReview[];
  seed: number;
}

/** Streets in deal order with their card counts, for walking a board prefix. */
const STREETS = [
  { street: 'flop', count: 3 },
  { street: 'turn', count: 1 },
  { street: 'river', count: 1 },
] as const;

export function buildObservedHand(input: ObservedHandInput): ArchivedHand {
  // A board that never completed its flop is treated as preflop: the cards
  // were candidates, not state, and must not enter the record.
  const board = streetOfBoard(input.board.length) === null ? [] : input.board;
  const players = input.opponents + 1;
  const button: SeatIndex = input.opponents;

  const taken = new Set<Card>([...input.heroCards, ...board]);
  const rest = shuffle(
    allCards().filter((card) => !taken.has(card)),
    createRng(input.seed),
  );

  // 47+ unobserved cards cover at most 16 villain holes and 3 burns, so the
  // pool cannot run dry; the guard keeps the type honest without an assertion.
  let next = 0;
  const draw = (): Card => {
    const card = rest[next];

    if (card === undefined) {
      throw new RangeError('Ran out of cards synthesizing an observed hand.');
    }

    next += 1;

    return card;
  };

  // The deck, with what was observed pinned where the deal would put it:
  // hole cards first (hero's two leading), then burn-flop-burn-turn-burn-river.
  const deck: Card[] = [...input.heroCards];

  while (deck.length < 2 * players) {
    deck.push(draw());
  }

  const events: HandEvent[] = [
    { type: 'handStart', handNumber: input.handNumber, seed: input.seed, button, deck },
    { type: 'holeCardsDealt', seat: 0, cards: input.heroCards },
  ];

  let dealt = 0;

  for (const { street, count } of STREETS) {
    if (board.length < dealt + count) {
      break;
    }

    const burned = draw();
    const cards = board.slice(dealt, dealt + count);

    deck.push(burned, ...cards);
    events.push({ type: 'streetDealt', street, cards, burned });
    dealt += count;
  }

  deck.push(...rest.slice(next));
  events.push({ type: 'handEnd', street: streetOfBoard(board.length) ?? 'preflop' });

  return {
    handNumber: input.handNumber,
    seed: input.seed,
    button,
    blinds: { smallBlind: LIVE_BIG_BLIND / 2, bigBlind: LIVE_BIG_BLIND },
    seats: [
      { id: 'You', stack: Math.round(input.heroStackBb * LIVE_BIG_BLIND) },
      ...Array.from({ length: input.opponents }, (_, index) => ({
        id: `Player ${index + 2}`,
        stack: 200 * LIVE_BIG_BLIND,
      })),
    ],
    events,
    // What the hand won or lost was never observed; zero is the only honest
    // figure, and the history list reads it as break-even rather than a guess.
    heroNet: 0,
    reviews: input.reviews,
  };
}
