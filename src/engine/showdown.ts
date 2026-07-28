/**
 * Showdown: who wins which pot, and who has to show to prove it.
 *
 * Comparing hands is a single integer comparison because `evaluateHand` packs
 * its result — equal values are an exact tie and therefore a split pot, with no
 * epsilon anywhere.
 *
 * Reveal order is part of the output, not a UI detail. The last aggressor shows
 * first and everyone after them may muck a hand that cannot win, which is
 * exactly what a player at the table gets to see. Bots and the coach must not
 * learn cards that were never shown.
 */

import { type Card } from './cards';
import { evaluateHand, type HandRank } from './evaluator';
import { awardPot, type Award } from './pots';
import { nextSeat, type Player, type Pot, type SeatIndex } from './table';

export interface ShowdownEntry {
  seat: SeatIndex;
  cards: readonly [Card, Card];
  rank: HandRank;
  /**
   * True when this hand was beaten by one already shown and never had to be
   * exposed. Its cards stay out of the replay log.
   */
  mucked: boolean;
}

export interface ShowdownResult {
  /** In reveal order: last aggressor first, then clockwise. */
  entries: readonly ShowdownEntry[];
  awards: readonly Award[];
}

/**
 * Ranks every contesting hand, awards each pot to its best eligible hand and
 * works out who had to show.
 *
 * @param firstToShow the last aggressor, or the first seat left of the button
 *   when the street was checked through.
 */
export function resolveShowdown(
  players: readonly Player[],
  pots: readonly Pot[],
  board: readonly Card[],
  button: SeatIndex,
  firstToShow: SeatIndex,
): ShowdownResult {
  const contesting = players.filter(
    (player) => (player.status === 'active' || player.status === 'allIn') && player.holeCards,
  );

  const ranked = new Map<SeatIndex, HandRank>();

  for (const player of contesting) {
    const cards = player.holeCards as readonly [Card, Card];

    ranked.set(player.seat, evaluateHand([...cards, ...board]));
  }

  const awards: Award[] = [];

  pots.forEach((pot, potIndex) => {
    const claimants = pot.eligible.filter((seat) => ranked.has(seat));

    if (claimants.length === 0) {
      return;
    }

    const best = Math.max(...claimants.map((seat) => rankValue(ranked, seat)));
    const winners = claimants.filter((seat) => rankValue(ranked, seat) === best);

    awards.push(...awardPot(pot, winners, potIndex, button, players.length));
  });

  return { entries: buildEntries(contesting, ranked, players, firstToShow), awards };
}

function rankValue(ranked: Map<SeatIndex, HandRank>, seat: SeatIndex): number {
  const rank = ranked.get(seat);

  if (!rank) {
    throw new RangeError(`Seat ${seat} has no ranked hand at showdown.`);
  }

  return rank.value;
}

/**
 * Reveal order and mucking.
 *
 * A hand only has to be shown if it beats or ties everything shown before it.
 * Anything worse is mucked — the player folds face down rather than give away
 * information for free, which is what a real table does.
 */
function buildEntries(
  contesting: readonly Player[],
  ranked: Map<SeatIndex, HandRank>,
  players: readonly Player[],
  firstToShow: SeatIndex,
): ShowdownEntry[] {
  const order = revealOrder(contesting, players, firstToShow);
  const entries: ShowdownEntry[] = [];
  let bestShown = -1;

  for (const player of order) {
    const rank = ranked.get(player.seat) as HandRank;
    const mucked = rank.value < bestShown;

    if (!mucked) {
      bestShown = rank.value;
    }

    entries.push({
      seat: player.seat,
      cards: player.holeCards as readonly [Card, Card],
      rank,
      mucked,
    });
  }

  return entries;
}

/** Contesting players clockwise from `firstToShow`, starting with them. */
function revealOrder(
  contesting: readonly Player[],
  players: readonly Player[],
  firstToShow: SeatIndex,
): Player[] {
  const bySeat = new Map(contesting.map((player) => [player.seat, player]));
  const order: Player[] = [];
  const first = bySeat.get(firstToShow);

  if (first) {
    order.push(first);
  }

  let seat = firstToShow;

  while (order.length < contesting.length) {
    const next = nextSeat(players, seat, (player) => bySeat.has(player.seat));

    if (next === null || next === firstToShow) {
      break;
    }

    order.push(bySeat.get(next) as Player);
    seat = next;
  }

  return order;
}
