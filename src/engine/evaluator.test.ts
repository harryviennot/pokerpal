import { allCards, parseCards, type Card } from './cards';
import { createDeck, shuffle } from './deck';
import {
  categoryName,
  categoryOf,
  compareHands,
  evaluateHand,
  handValue,
  HandCategory,
} from './evaluator';
import { createRng } from './rng';

const hand = (notation: string): Card[] => parseCards(notation);

describe('category detection', () => {
  const cases: [string, HandCategory][] = [
    ['As Ks Qs Js Ts', HandCategory.StraightFlush],
    ['9h 8h 7h 6h 5h', HandCategory.StraightFlush],
    ['5c 4c 3c 2c Ac', HandCategory.StraightFlush],
    ['7c 7d 7h 7s 2d', HandCategory.FourOfAKind],
    ['Kc Kd Kh 4s 4d', HandCategory.FullHouse],
    ['Ah Jh 8h 5h 2h', HandCategory.Flush],
    ['9c 8d 7h 6s 5c', HandCategory.Straight],
    ['Ac 2d 3h 4s 5c', HandCategory.Straight],
    ['Ad Ks Qh Jc Td', HandCategory.Straight],
    ['Qc Qd Qh 7s 2d', HandCategory.ThreeOfAKind],
    ['Jc Jd 4h 4s 9d', HandCategory.TwoPair],
    ['Tc Td 8h 5s 2d', HandCategory.Pair],
    ['Ac Jd 8h 5s 2d', HandCategory.HighCard],
  ];

  it.each(cases)('classifies %s', (notation, expected) => {
    expect(evaluateHand(hand(notation)).category).toBe(expected);
  });

  it('reads the wheel as a five-high straight, not ace-high', () => {
    const wheel = evaluateHand(hand('Ac 2d 3h 4s 5c'));
    const sixHigh = evaluateHand(hand('2c 3d 4h 5s 6c'));

    expect(wheel.ranks[0]).toBe(5);
    expect(wheel.value).toBeLessThan(sixHigh.value);
  });

  it('reads the steel wheel as a five-high straight flush', () => {
    const steelWheel = evaluateHand(hand('Ac 2c 3c 4c 5c'));

    expect(steelWheel.category).toBe(HandCategory.StraightFlush);
    expect(steelWheel.ranks[0]).toBe(5);
    expect(steelWheel.value).toBeLessThan(evaluateHand(hand('6c 2c 3c 4c 5c')).value);
  });
});

describe('category ordering', () => {
  it('ranks every category above the one below it', () => {
    const ladder = [
      'Ac Jd 8h 5s 2d',
      'Tc Td 8h 5s 2d',
      'Jc Jd 4h 4s 9d',
      'Qc Qd Qh 7s 2d',
      '9c 8d 7h 6s 5c',
      'Ah Jh 8h 5h 2h',
      'Kc Kd Kh 4s 4d',
      '7c 7d 7h 7s 2d',
      'As Ks Qs Js Ts',
    ].map((notation) => handValue(hand(notation)));

    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]).toBeGreaterThan(ladder[i - 1] as number);
    }
  });
});

describe('tie-breaking within a category', () => {
  it('compares kickers on a pair', () => {
    expect(compareHands(hand('9c 9d Ah 5s 2d'), hand('9h 9s Kh 5c 2c'))).toBeGreaterThan(0);
    expect(compareHands(hand('9c 9d Ah 5s 2d'), hand('9h 9s Ac 5c 3c'))).toBeLessThan(0);
  });

  it('compares the high pair first on two pair', () => {
    expect(compareHands(hand('Kc Kd 2h 2s 9d'), hand('Qc Qd Jh Js 9c'))).toBeGreaterThan(0);
  });

  it('compares the trips rank first on a full house', () => {
    expect(compareHands(hand('2c 2d 2h Ks Kd'), hand('Ac Ad Qh Qs Qd'))).toBeLessThan(0);
  });

  it('compares flushes card by card', () => {
    expect(compareHands(hand('Ah Qh 8h 5h 2h'), hand('Ah Jh Th 9h 8h'))).toBeGreaterThan(0);
  });

  it('reports an exact tie when two hands play the same five cards', () => {
    // The board plays: both players hold nothing that beats it.
    expect(compareHands(hand('As Ks Qs Js Ts 2c 3d'), hand('As Ks Qs Js Ts 4h 5h'))).toBe(0);
  });

  it('treats identical five-card hands in different suits as a split', () => {
    expect(compareHands(hand('Ac Kd Qh Js 9c'), hand('Ad Kh Qs Jc 9d'))).toBe(0);
  });
});

describe('seven-card hands', () => {
  /** Best of all 21 five-card subsets — the slow, obviously-correct reference. */
  function bestOfSubsets(cards: readonly Card[]): number {
    let best = -1;

    for (let a = 0; a < cards.length - 4; a++) {
      for (let b = a + 1; b < cards.length - 3; b++) {
        for (let c = b + 1; c < cards.length - 2; c++) {
          for (let d = c + 1; d < cards.length - 1; d++) {
            for (let e = d + 1; e < cards.length; e++) {
              const value = handValue([
                cards[a] as Card,
                cards[b] as Card,
                cards[c] as Card,
                cards[d] as Card,
                cards[e] as Card,
              ]);

              if (value > best) best = value;
            }
          }
        }
      }
    }

    return best;
  }

  it('picks the best five of seven on known spots', () => {
    // Board pairs the turn: trips beats the flopped two pair.
    expect(evaluateHand(hand('Ah Ad Kc Kd Ks 2c 3h')).category).toBe(HandCategory.FullHouse);
    // Four to a flush on board plus one in hand.
    expect(evaluateHand(hand('2h 7h Kh 9h 3h Ac Kd')).category).toBe(HandCategory.Flush);
    // Straight using one hole card.
    expect(evaluateHand(hand('9c 8d 7h 6s 2c 2d 5h')).category).toBe(HandCategory.Straight);
  });

  it('matches the 21-subset reference across 20000 random seven-card hands', () => {
    const rng = createRng(20260728);
    const deck = createDeck();

    for (let i = 0; i < 20_000; i++) {
      shuffle(deck, rng);
      const seven = deck.slice(0, 7);

      expect(handValue(seven)).toBe(bestOfSubsets(seven));
    }
  });

  it('never lets a flush hide quads or a full house', () => {
    // Five of a suit plus a pair: the flush is genuinely the best hand here.
    const evaluated = evaluateHand(hand('As Ks Qs Js 9s Ah Ad'));

    expect(evaluated.category).toBe(HandCategory.Flush);
  });
});

describe('exhaustive five-card enumeration', () => {
  // Every distinct five-card hand, scored once. This is the strongest single
  // statement of correctness available: the category histogram and the count of
  // distinct hand values are both textbook constants.
  const histogram = new Map<HandCategory, number>();
  const distinctValues = new Set<number>();

  beforeAll(() => {
    const deck = allCards();
    const five: Card[] = [0, 0, 0, 0, 0] as Card[];

    for (let a = 0; a < 48; a++) {
      five[0] = deck[a] as Card;
      for (let b = a + 1; b < 49; b++) {
        five[1] = deck[b] as Card;
        for (let c = b + 1; c < 50; c++) {
          five[2] = deck[c] as Card;
          for (let d = c + 1; d < 51; d++) {
            five[3] = deck[d] as Card;
            for (let e = d + 1; e < 52; e++) {
              five[4] = deck[e] as Card;

              const value = handValue(five);
              const category = categoryOf(value);

              distinctValues.add(value);
              histogram.set(category, (histogram.get(category) ?? 0) + 1);
            }
          }
        }
      }
    }
  });

  it('counts 2598960 distinct five-card hands', () => {
    const total = [...histogram.values()].reduce((sum, count) => sum + count, 0);

    expect(total).toBe(2_598_960);
  });

  it.each([
    [HandCategory.StraightFlush, 40],
    [HandCategory.FourOfAKind, 624],
    [HandCategory.FullHouse, 3_744],
    [HandCategory.Flush, 5_108],
    [HandCategory.Straight, 10_200],
    [HandCategory.ThreeOfAKind, 54_912],
    [HandCategory.TwoPair, 123_552],
    [HandCategory.Pair, 1_098_240],
    [HandCategory.HighCard, 1_302_540],
  ])('finds the textbook number of %s hands', (category, expected) => {
    expect(histogram.get(category)).toBe(expected);
  });

  it('produces exactly 7462 distinct hand values', () => {
    expect(distinctValues.size).toBe(7_462);
  });
});

describe('categoryName', () => {
  it('names every category for the coach and the UI', () => {
    expect(categoryName(HandCategory.StraightFlush)).toBe('Straight flush');
    expect(categoryName(HandCategory.TwoPair)).toBe('Two pair');
    expect(categoryName(HandCategory.HighCard)).toBe('High card');
  });
});
