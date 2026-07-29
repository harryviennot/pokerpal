/**
 * Human copy for made hands: the winner banner ("wins with a full house") and
 * the hero's live hand caption ("Pair of nines").
 *
 * Copy is sentence case with no jargon, per the app's copy rules. Everything
 * here is display-path string building on top of the evaluator.
 */

import { rankOf, type Card, type Rank } from './cards';
import { evaluateHand, HandCategory, type HandRank } from './evaluator';

const PLURAL: Record<Rank, string> = {
  2: 'twos',
  3: 'threes',
  4: 'fours',
  5: 'fives',
  6: 'sixes',
  7: 'sevens',
  8: 'eights',
  9: 'nines',
  10: 'tens',
  11: 'jacks',
  12: 'queens',
  13: 'kings',
  14: 'aces',
};

const SINGULAR: Record<Rank, string> = {
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'jack',
  12: 'queen',
  13: 'king',
  14: 'ace',
};

const ACE: Rank = 14;

/** "Pair of nines", "Nines full of fours", "Ace-high flush", "Royal flush". */
export function describeHandRank(rank: HandRank): string {
  const [first, second] = rank.ranks;

  if (first === undefined) {
    throw new RangeError('A hand rank must carry at least one significant rank.');
  }

  switch (rank.category) {
    case HandCategory.HighCard:
      return sentence(`${SINGULAR[first]} high`);
    case HandCategory.Pair:
      return `Pair of ${PLURAL[first]}`;
    case HandCategory.TwoPair:
      return `Two pair, ${PLURAL[first]} and ${PLURAL[second ?? first]}`;
    case HandCategory.ThreeOfAKind:
      return `Three of a kind, ${PLURAL[first]}`;
    case HandCategory.Straight:
      return sentence(`${SINGULAR[first]}-high straight`);
    case HandCategory.Flush:
      return sentence(`${SINGULAR[first]}-high flush`);
    case HandCategory.FullHouse:
      return sentence(`${PLURAL[first]} full of ${PLURAL[second ?? first]}`);
    case HandCategory.FourOfAKind:
      return `Four of a kind, ${PLURAL[first]}`;
    case HandCategory.StraightFlush:
      return first === ACE ? 'Royal flush' : sentence(`${SINGULAR[first]}-high straight flush`);
  }
}

/**
 * The hero's live made hand for the caption under their cards.
 *
 * Preflop there is no five-card hand to evaluate, so the two hole cards speak
 * for themselves: a pocket pair or the high card.
 */
export function describeMadeHand(hole: readonly [Card, Card], board: readonly Card[]): string {
  if (board.length === 0) {
    const [a, b] = [rankOf(hole[0]), rankOf(hole[1])];

    return a === b ? `Pair of ${PLURAL[a]}` : sentence(`${SINGULAR[a > b ? a : b]} high`);
  }

  return describeHandRank(evaluateHand([...hole, ...board]));
}

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
