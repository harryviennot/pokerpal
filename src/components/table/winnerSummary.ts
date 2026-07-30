/**
 * Pure selectors over a `TableSnapshot` for the showdown presentation: the
 * caption under the board, the plate over each seat's name, and the set of cards
 * that actually play.
 */

import {
  categoryName,
  describeMadeHand,
  type Card,
  type ReplaySeat,
  type TableSnapshot,
} from '@/engine';

/**
 * The caption on the felt: "Ava wins the hand", "Ava and Ben split the pot".
 * Null while the hand is live.
 *
 * Deliberately says nothing about the cards. The hand a pot was won with belongs
 * on the winner's own plate, where it sits beside the chips it earned.
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
    return `${names(winners)} split the pot`;
  }

  // The hero's seat is named "You", and "You wins the hand" reads as a bug.
  return first.id === 'You' ? 'You win the hand' : `${first.id} wins the hand`;
}

/**
 * What a seat's made-hand plate says, or null when it should not have one.
 *
 * Three cases, and no more: a seat that has turned its cards up shows the hand
 * it showed down, the hero's own live hand is named while the hand is still
 * running, and anyone who folded or mucked shows nothing.
 */
export function madeHandLabel(
  seat: ReplaySeat,
  snapshot: TableSnapshot,
  hero: boolean,
): string | null {
  if (seat.status === 'folded' || seat.status === 'sittingOut' || seat.mucked) {
    return null;
  }

  if (seat.shown && seat.rank !== null) {
    // The category alone, reference-style: "Two pair", not "Two pair, kings and
    // eights". The long form is the coach's vocabulary and does not fit a plate.
    return categoryName(seat.rank.category);
  }

  if (hero && !snapshot.complete && seat.holeCards !== null) {
    return shortLabel(describeMadeHand(seat.holeCards, snapshot.board));
  }

  return null;
}

/** "Two pair, kings and eights" → "Two pair"; "Pair of fours" stays whole. */
function shortLabel(described: string): string {
  const comma = described.indexOf(',');

  return comma === -1 ? described : described.slice(0, comma);
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

/** "Ava", "Ava and Ben", "Ava, Ben and Cass". */
function names(seats: readonly ReplaySeat[]): string {
  const ids = seats.map((seat) => seat.id);
  const last = ids.pop() ?? '';

  return ids.length === 0 ? last : `${ids.join(', ')} and ${last}`;
}
