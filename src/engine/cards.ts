/**
 * Card model.
 *
 * A `Card` is a branded integer `0..51`, not an object: the Monte Carlo
 * simulator evaluates millions of cards per run and object-per-card allocation
 * would dominate that budget. The brand keeps illegal values unrepresentable —
 * a plain number cannot be passed where a `Card` is expected, and the only ways
 * to obtain one are `makeCard` and `parseCard`.
 *
 * Encoding: `rankIndex * 4 + suitIndex`, so cards sort by rank then suit.
 */

/** Ace is high at 14. The wheel (A-2-3-4-5) is handled by the evaluator. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type Suit = 'c' | 'd' | 'h' | 's';

declare const cardBrand: unique symbol;
export type Card = number & { readonly [cardBrand]: true };

export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const SUITS: readonly Suit[] = ['c', 'd', 'h', 's'];

export const CARD_COUNT = 52;

/** Single-character rank labels, indexed by rank index (0 = deuce). */
const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;

const SUIT_SYMBOLS: Record<Suit, string> = { c: '♣', d: '♦', h: '♥', s: '♠' };

export class InvalidCardError extends Error {
  constructor(input: string) {
    super(`Not a card: "${input}". Expected a rank (2-9, T, J, Q, K, A) then a suit (c, d, h, s).`);
    this.name = 'InvalidCardError';
  }
}

/** Internal rank index, 0 for a deuce through 12 for an ace. */
export function rankIndexOf(card: Card): number {
  return card >> 2;
}

/** Internal suit index, matching the order of `SUITS`. */
export function suitIndexOf(card: Card): number {
  return card & 3;
}

export function rankOf(card: Card): Rank {
  return (rankIndexOf(card) + 2) as Rank;
}

export function suitOf(card: Card): Suit {
  return SUITS[suitIndexOf(card)] as Suit;
}

export function makeCard(rank: Rank, suit: Suit): Card {
  return ((rank - 2) * 4 + SUITS.indexOf(suit)) as Card;
}

/** Every card in the deck, in ascending order. */
export function allCards(): Card[] {
  return Array.from({ length: CARD_COUNT }, (_, index) => index as Card);
}

/**
 * Parses shorthand such as `Ah`, `td` or `7S`. Rank is case-insensitive and
 * `10` is accepted alongside `T`.
 *
 * @throws {InvalidCardError} when the input is not a valid card.
 */
export function parseCard(input: string): Card {
  const trimmed = input.trim();
  const match = /^(10|[2-9tjqka])([cdhs])$/i.exec(trimmed);

  if (!match) {
    throw new InvalidCardError(input);
  }

  const rankToken = match[1]!.toUpperCase();
  const suitToken = match[2]!.toLowerCase() as Suit;
  const label = rankToken === '10' ? 'T' : rankToken;
  const rankIndex = RANK_LABELS.findIndex((candidate) => candidate === label);

  return (rankIndex * 4 + SUITS.indexOf(suitToken)) as Card;
}

/** Parses a whitespace-separated list such as `"Ah Kd 7c"`. */
export function parseCards(input: string): Card[] {
  const tokens = input.trim().split(/\s+/).filter(Boolean);

  return tokens.map(parseCard);
}

/** Machine-readable shorthand, e.g. `Ah`. Round-trips through `parseCard`. */
export function formatCard(card: Card): string {
  return `${RANK_LABELS[rankIndexOf(card)]}${suitOf(card)}`;
}

/** Display form with a suit symbol, e.g. `A♥`. */
export function formatCardPretty(card: Card): string {
  return `${RANK_LABELS[rankIndexOf(card)]}${SUIT_SYMBOLS[suitOf(card)]}`;
}

/** Display label for a rank on its own, e.g. `T` for a ten. */
export function formatRank(rank: Rank): string {
  return RANK_LABELS[rank - 2] as string;
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOLS[suit];
}

/** True when hearts or diamonds — the suits drawn in red. */
export function isRedSuit(suit: Suit): boolean {
  return suit === 'h' || suit === 'd';
}
