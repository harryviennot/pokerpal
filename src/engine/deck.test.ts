import { CARD_COUNT, formatCard, parseCards, type Card } from './cards';
import { createDeck, drawInto, hasDuplicates, remainingDeck, shuffle } from './deck';
import { createRng } from './rng';

describe('createDeck', () => {
  it('returns all 52 cards exactly once', () => {
    const deck = createDeck();

    expect(deck).toHaveLength(CARD_COUNT);
    expect(new Set(deck).size).toBe(CARD_COUNT);
  });
});

describe('shuffle', () => {
  it('preserves the multiset of cards', () => {
    const deck = shuffle(createDeck(), createRng(1));

    expect(deck).toHaveLength(CARD_COUNT);
    expect(new Set(deck).size).toBe(CARD_COUNT);
  });

  it('is deterministic for a given seed', () => {
    const a = shuffle(createDeck(), createRng(2026)).map(formatCard);
    const b = shuffle(createDeck(), createRng(2026)).map(formatCard);

    expect(a).toEqual(b);
  });

  it('produces a different order for a different seed', () => {
    const a = shuffle(createDeck(), createRng(1)).map(formatCard);
    const b = shuffle(createDeck(), createRng(2)).map(formatCard);

    expect(a).not.toEqual(b);
  });

  it('actually moves cards', () => {
    const ordered = createDeck();
    const shuffled = shuffle(createDeck(), createRng(7));
    const samePosition = shuffled.filter((card, index) => card === ordered[index]).length;

    // A fair shuffle leaves ~1 card in place on average; 10 would signal a bug.
    expect(samePosition).toBeLessThan(10);
  });

  it('does not favour any position over many shuffles', () => {
    const rng = createRng(31337);
    const timesAceOfSpadesWasFirst = Array.from({ length: 5200 }, () => {
      const deck = shuffle(createDeck(), rng);
      return deck[0] === 51 ? 1 : 0;
    }).reduce<number>((sum, hit) => sum + hit, 0);

    // Expectation is 100 out of 5200 draws.
    expect(timesAceOfSpadesWasFirst).toBeGreaterThan(60);
    expect(timesAceOfSpadesWasFirst).toBeLessThan(150);
  });
});

describe('remainingDeck', () => {
  it('removes the known cards', () => {
    const known = parseCards('Ah Kd 7c');
    const rest = remainingDeck(known);

    expect(rest).toHaveLength(CARD_COUNT - known.length);
    for (const card of known) {
      expect(rest).not.toContain(card);
    }
  });

  it('returns a full deck when nothing is known', () => {
    expect(remainingDeck([])).toHaveLength(CARD_COUNT);
  });

  it('tolerates a card listed twice', () => {
    const ace = parseCards('Ah')[0] as Card;

    expect(remainingDeck([ace, ace])).toHaveLength(CARD_COUNT - 1);
  });
});

describe('drawInto', () => {
  it('draws distinct cards from the deck', () => {
    const rng = createRng(9);
    const deck = createDeck();
    const out: Card[] = [];

    drawInto(deck, 5, rng, out);

    expect(out).toHaveLength(5);
    expect(new Set(out).size).toBe(5);
    for (const card of out) {
      expect(deck).toContain(card);
    }
  });

  it('leaves the deck a permutation of itself so it can be reused', () => {
    const rng = createRng(4);
    const deck = createDeck();
    const out: Card[] = [];

    for (let i = 0; i < 100; i++) {
      drawInto(deck, 7, rng, out);
    }

    expect(new Set(deck).size).toBe(CARD_COUNT);
  });

  it('is deterministic for a given seed', () => {
    const draw = (): Card[] => {
      const out: Card[] = [];
      drawInto(createDeck(), 5, createRng(77), out);
      return out;
    };

    expect(draw()).toEqual(draw());
  });
});

describe('hasDuplicates', () => {
  it('spots a repeated card', () => {
    expect(hasDuplicates(parseCards('Ah Kd Ah'))).toBe(true);
  });

  it('accepts a clean hand', () => {
    expect(hasDuplicates(parseCards('Ah Kd 7c 2s'))).toBe(false);
    expect(hasDuplicates([])).toBe(false);
  });
});
