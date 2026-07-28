import {
  allCards,
  CARD_COUNT,
  formatCard,
  formatCardPretty,
  formatRank,
  InvalidCardError,
  isRedSuit,
  makeCard,
  parseCard,
  parseCards,
  RANKS,
  rankOf,
  SUITS,
  suitOf,
} from './cards';

describe('card encoding', () => {
  it('covers the full deck exactly once', () => {
    const deck = allCards();

    expect(deck).toHaveLength(CARD_COUNT);
    expect(new Set(deck).size).toBe(CARD_COUNT);
  });

  it('round-trips every rank and suit through makeCard', () => {
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        const card = makeCard(rank, suit);

        expect(rankOf(card)).toBe(rank);
        expect(suitOf(card)).toBe(suit);
      }
    }
  });

  it('assigns every rank/suit pair a distinct id in 0..51', () => {
    const ids = RANKS.flatMap((rank) => SUITS.map((suit) => makeCard(rank, suit)));

    expect(new Set(ids).size).toBe(CARD_COUNT);
    expect(Math.min(...ids)).toBe(0);
    expect(Math.max(...ids)).toBe(CARD_COUNT - 1);
  });
});

describe('parseCard', () => {
  it('parses shorthand for every card', () => {
    for (const card of allCards()) {
      expect(parseCard(formatCard(card))).toBe(card);
    }
  });

  it('accepts mixed case and the two-character ten', () => {
    expect(parseCard('ah')).toBe(parseCard('AH'));
    expect(parseCard('10d')).toBe(parseCard('Td'));
    expect(parseCard('  7s  ')).toBe(makeCard(7, 's'));
  });

  it('rejects malformed input rather than guessing', () => {
    for (const bad of ['', 'A', 'h', 'Ax', '1h', 'AA', '11c', 'Ahh']) {
      expect(() => parseCard(bad)).toThrow(InvalidCardError);
    }
  });

  it('parses a whitespace-separated list', () => {
    expect(parseCards('Ah Kd 7c')).toEqual([
      makeCard(14, 'h'),
      makeCard(13, 'd'),
      makeCard(7, 'c'),
    ]);
  });
});

describe('formatting', () => {
  it('renders shorthand and pretty forms', () => {
    expect(formatCard(makeCard(14, 's'))).toBe('As');
    expect(formatCard(makeCard(10, 'd'))).toBe('Td');
    expect(formatCardPretty(makeCard(14, 'h'))).toBe('A♥');
    expect(formatCardPretty(makeCard(2, 'c'))).toBe('2♣');
  });

  it('labels ranks for the picker', () => {
    expect(formatRank(14)).toBe('A');
    expect(formatRank(10)).toBe('T');
    expect(formatRank(2)).toBe('2');
  });

  it('knows which suits are red', () => {
    expect(isRedSuit('h')).toBe(true);
    expect(isRedSuit('d')).toBe(true);
    expect(isRedSuit('s')).toBe(false);
    expect(isRedSuit('c')).toBe(false);
  });
});
