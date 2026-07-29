/**
 * Pure selectors over a `TableSnapshot` for the showdown presentation: the
 * banner copy under the board and the set of cards that actually play.
 */

import { HandCategory, type Card, type TableSnapshot } from '@/engine';

const CATEGORY_PHRASES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'high card',
  [HandCategory.Pair]: 'a pair',
  [HandCategory.TwoPair]: 'two pair',
  [HandCategory.ThreeOfAKind]: 'three of a kind',
  [HandCategory.Straight]: 'a straight',
  [HandCategory.Flush]: 'a flush',
  [HandCategory.FullHouse]: 'a full house',
  [HandCategory.FourOfAKind]: 'four of a kind',
  [HandCategory.StraightFlush]: 'a straight flush',
};

/**
 * One line for the banner: "Ava wins with a full house", "Ava wins" on a
 * fold-out, "Ava and Ben split the pot". Null while the hand is live.
 */
export function winnerSummary(snapshot: TableSnapshot): string | null {
  if (!snapshot.complete) {
    return null;
  }

  const winners = snapshot.seats.filter((seat) => seat.won > 0);
  const first = winners[0];

  if (first === undefined) {
    return null;
  }

  if (winners.length > 1) {
    return `${winners.map((seat) => seat.id).join(' and ')} split the pot`;
  }

  return first.rank
    ? `${first.id} wins with ${CATEGORY_PHRASES[first.rank.category]}`
    : `${first.id} wins`;
}

/**
 * Every card that plays in a winning shown hand. Empty while the hand is live,
 * when the pot was won without a showdown, or for hands logged before
 * `bestFive` existed — an empty set dims nothing.
 */
export function winningFive(snapshot: TableSnapshot): ReadonlySet<Card> {
  const cards = new Set<Card>();

  if (!snapshot.complete) {
    return cards;
  }

  for (const seat of snapshot.seats) {
    if (seat.won > 0 && seat.shown && seat.bestFive) {
      for (const card of seat.bestFive) {
        cards.add(card);
      }
    }
  }

  return cards;
}
