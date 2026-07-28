/**
 * Draw and out detection for the calculator's explanation panel (PRD §A).
 *
 * "Outs" means cards that complete a detected straight or flush draw — the
 * number a player says out loud, and the one the rule of 2 and 4 is built on.
 *
 * Deliberately *not* "every card that improves hero's category": pairing the
 * board improves hero's category while helping every opponent just as much, so
 * counting it would report 23 outs for a bare flush draw instead of 9. Equity
 * is the number that accounts for opponents properly, and the calculator shows
 * it alongside this count.
 */

import { rankIndexOf, suitIndexOf, type Card } from './cards';
import { remainingDeck } from './deck';
import { categoryOf, handValue, HandCategory } from './evaluator';

export type DrawType = 'flush' | 'openEnded' | 'gutshot' | 'backdoorFlush';

export interface DrawInfo {
  draws: DrawType[];
  /** Distinct cards that improve hero's category on the next street. */
  outs: Card[];
  /** Convenience: `outs.length`. */
  outCount: number;
}

const FLUSH_LENGTH = 5;

/**
 * Detects draws and counts outs for hero given the current board.
 *
 * Only meaningful on the flop or turn; with a complete board there is nothing
 * left to draw to and the result is empty.
 */
export function detectDraws(hero: readonly [Card, Card], board: readonly Card[]): DrawInfo {
  if (board.length < 3 || board.length >= 5) {
    return { draws: [], outs: [], outCount: 0 };
  }

  const current = [...hero, ...board];
  const currentCategory = categoryOf(handValue(current));
  const draws: DrawType[] = [];

  const suitCounts = new Int8Array(4);
  const rankMask = buildRankMask(current, suitCounts);

  if (suitCounts.some((count) => count === FLUSH_LENGTH - 1)) {
    draws.push('flush');
  } else if (board.length === 3 && suitCounts.some((count) => count === FLUSH_LENGTH - 2)) {
    draws.push('backdoorFlush');
  }

  const straightDraw = classifyStraightDraw(rankMask);

  if (straightDraw) {
    draws.push(straightDraw);
  }

  // Found by trying every remaining card rather than reasoning about patterns:
  // slower, but it cannot disagree with the evaluator.
  const outs: Card[] = [];

  for (const card of remainingDeck(current)) {
    const improved = categoryOf(handValue([...current, card]));

    if (improved > currentCategory && improved >= HandCategory.Straight) {
      outs.push(card);
    }
  }

  return { draws, outs, outCount: outs.length };
}

function buildRankMask(cards: readonly Card[], suitCounts: Int8Array): number {
  let mask = 0;

  for (const card of cards) {
    mask |= 1 << rankIndexOf(card);

    const suit = suitIndexOf(card);

    suitCounts[suit] = (suitCounts[suit] as number) + 1;
  }

  return mask;
}

/**
 * Distinguishes an open-ended draw from a gutshot by counting how many distinct
 * ranks would complete a straight, and whether the four cards hero holds run
 * consecutively.
 */
function classifyStraightDraw(rankMask: number): DrawType | null {
  const completingRanks: number[] = [];

  for (let rank = 0; rank < 13; rank++) {
    if ((rankMask & (1 << rank)) !== 0) {
      continue;
    }

    if (makesStraight(rankMask | (1 << rank))) {
      completingRanks.push(rank);
    }
  }

  if (completingRanks.length === 0) {
    return null;
  }

  // Two or more completing ranks means both ends are live: an open-ender (or a
  // double gutshot, which is worth the same number of outs).
  return completingRanks.length >= 2 ? 'openEnded' : 'gutshot';
}

function makesStraight(mask: number): boolean {
  const wheel = (1 << 12) | 0b1111;

  if ((mask & wheel) === wheel) {
    return true;
  }

  for (let high = 12; high >= 4; high--) {
    const run = 0b11111 << (high - 4);

    if ((mask & run) === run) {
      return true;
    }
  }

  return false;
}

const DRAW_LABELS: Record<DrawType, string> = {
  flush: 'Flush draw',
  openEnded: 'Open-ended straight draw',
  gutshot: 'Gutshot',
  backdoorFlush: 'Backdoor flush draw',
};

export function drawLabel(draw: DrawType): string {
  return DRAW_LABELS[draw];
}

/**
 * The classic "rule of 2 and 4" shortcut: rough equity from an out count.
 * Returns 0 to 1. Approximate by design — the calculator shows real equity
 * alongside it.
 */
export function outsToEquity(outs: number, streetsToCome: 1 | 2): number {
  const percent = streetsToCome === 2 ? outs * 4 : outs * 2;

  return Math.min(1, percent / 100);
}
