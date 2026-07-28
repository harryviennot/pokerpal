import { allCards, CARD_COUNT, type Card } from './cards';
import { type Rng } from './rng';

/** A fresh 52-card deck in ascending order. */
export function createDeck(): Card[] {
  return allCards();
}

/**
 * Fisher-Yates shuffle, in place. Returns the same array for convenience.
 * Deterministic for a given `Rng` sequence.
 */
export function shuffle(deck: Card[], rng: Rng): Card[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const swap = deck[i] as Card;
    deck[i] = deck[j] as Card;
    deck[j] = swap;
  }

  return deck;
}

/** A deck with `excluded` removed — the cards still live after a known board and hole cards. */
export function remainingDeck(excluded: Iterable<Card>): Card[] {
  const dead = new Uint8Array(CARD_COUNT);

  for (const card of excluded) {
    dead[card] = 1;
  }

  const deck: Card[] = [];

  for (let card = 0; card < CARD_COUNT; card++) {
    if (dead[card] === 0) {
      deck.push(card as Card);
    }
  }

  return deck;
}

/**
 * Draws `count` distinct cards from the front of `deck` using a partial
 * Fisher-Yates pass, writing them into `out`.
 *
 * The deck is permuted in place rather than copied, so a simulation loop can
 * reuse one array across every iteration without allocating.
 */
export function drawInto(deck: Card[], count: number, rng: Rng, out: Card[]): void {
  for (let i = 0; i < count; i++) {
    const j = i + rng.nextInt(deck.length - i);
    const swap = deck[i] as Card;
    deck[i] = deck[j] as Card;
    deck[j] = swap;
    out[i] = deck[i] as Card;
  }
}

/** True when the same card appears twice. */
export function hasDuplicates(cards: readonly Card[]): boolean {
  const seen = new Uint8Array(CARD_COUNT);

  for (const card of cards) {
    if (seen[card] === 1) {
      return true;
    }
    seen[card] = 1;
  }

  return false;
}
