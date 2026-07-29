import { parseCards, type Card } from './cards';
import { describeHandRank, describeMadeHand } from './describeRank';
import { evaluateHand } from './evaluator';

const hole = (notation: string): readonly [Card, Card] => {
  const [first, second] = parseCards(notation);

  return [first as Card, second as Card];
};

describe('describeHandRank', () => {
  const cases: [string, string][] = [
    ['Ac Jd 8h 5s 2d', 'Ace high'],
    ['9c 9d Ah 5s 2d', 'Pair of nines'],
    ['Jc Jd 4h 4s 9d', 'Two pair, jacks and fours'],
    ['Qc Qd Qh 7s 2d', 'Three of a kind, queens'],
    ['9c 8d 7h 6s 5c', 'Nine-high straight'],
    ['Ac 2d 3h 4s 5c', 'Five-high straight'],
    ['Ah Jh 8h 5h 2h', 'Ace-high flush'],
    ['9c 9d 9h 4s 4d', 'Nines full of fours'],
    ['7c 7d 7h 7s 2d', 'Four of a kind, sevens'],
    ['9h 8h 7h 6h 5h', 'Nine-high straight flush'],
    ['As Ks Qs Js Ts', 'Royal flush'],
  ];

  it.each(cases)('describes %s as %s', (notation, expected) => {
    expect(describeHandRank(evaluateHand(parseCards(notation)))).toBe(expected);
  });
});

describe('describeMadeHand', () => {
  it('reads a pocket pair preflop without evaluating a board', () => {
    expect(describeMadeHand(hole('9c 9d'), [])).toBe('Pair of nines');
  });

  it('reads the high card of an unpaired preflop hand', () => {
    expect(describeMadeHand(hole('Ac 9d'), [])).toBe('Ace high');
    expect(describeMadeHand(hole('9d Ac'), [])).toBe('Ace high');
  });

  it('evaluates hole cards against the board after the flop', () => {
    expect(describeMadeHand(hole('9c 9d'), parseCards('9h 4s 4d'))).toBe('Nines full of fours');
    expect(describeMadeHand(hole('7s 2c'), parseCards('Ah Kd 9c'))).toBe('Ace high');
  });
});
