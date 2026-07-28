import { parseCards, type Card } from './cards';
import { detectDraws, drawLabel, outsToEquity } from './draws';

const hole = (notation: string): readonly [Card, Card] => {
  const cards = parseCards(notation);

  return [cards[0] as Card, cards[1] as Card];
};

describe('detectDraws', () => {
  it('spots a flush draw', () => {
    const result = detectDraws(hole('Ah 4h'), parseCards('Kh 8h 2c'));

    expect(result.draws).toContain('flush');
  });

  it('spots an open-ended straight draw', () => {
    const result = detectDraws(hole('Jc Ts'), parseCards('9d 8h 2c'));

    expect(result.draws).toContain('openEnded');
  });

  it('spots a gutshot', () => {
    const result = detectDraws(hole('Jc Ts'), parseCards('9d 7h 2c'));

    expect(result.draws).toContain('gutshot');
    expect(result.draws).not.toContain('openEnded');
  });

  it('spots a combo draw', () => {
    const result = detectDraws(hole('Jh Th'), parseCards('9h 8h 2d'));

    expect(result.draws).toContain('flush');
    expect(result.draws).toContain('openEnded');
  });

  it('spots a backdoor flush draw on the flop only', () => {
    expect(detectDraws(hole('Ah 4h'), parseCards('Kh 8c 2d')).draws).toContain('backdoorFlush');
    // On the turn there is only one card to come, so a backdoor is dead.
    expect(detectDraws(hole('Ah 4h'), parseCards('Kh 8c 2d 3s')).draws).not.toContain(
      'backdoorFlush',
    );
  });

  it('reports no draws when there are none', () => {
    const result = detectDraws(hole('Ac Kd'), parseCards('9s 5h 2c'));

    expect(result.draws).toHaveLength(0);
  });

  it('is empty with a complete board, where nothing is left to draw to', () => {
    const result = detectDraws(hole('Ah 4h'), parseCards('Kh 8h 2c 3d 5s'));

    expect(result.draws).toHaveLength(0);
    expect(result.outs).toHaveLength(0);
  });

  it('is empty preflop, before there is a board to read', () => {
    expect(detectDraws(hole('Ah Kh'), []).draws).toHaveLength(0);
  });

  it('does not call the wheel draw an open-ender', () => {
    // A-2 on 3-4-x can only be completed by a five.
    const result = detectDraws(hole('Ac 2d'), parseCards('3s 4h 9d'));

    expect(result.draws).toContain('gutshot');
    expect(result.draws).not.toContain('openEnded');
  });
});

describe('out counting', () => {
  it('counts exactly nine outs for a bare flush draw', () => {
    // Thirteen hearts less the four already visible.
    const result = detectDraws(hole('Ah 4h'), parseCards('Kh 8h 2c'));

    expect(result.outCount).toBe(9);
  });

  it('counts exactly eight outs for a bare open-ender', () => {
    // Four queens and four sevens.
    const result = detectDraws(hole('Jc Ts'), parseCards('9d 8h 2c'));

    expect(result.outCount).toBe(8);
  });

  it('counts exactly four outs for a gutshot', () => {
    // Only a jack completes J-T-9-8... here 8-9-T-J needs the queen or seven;
    // with a gap only one rank plays.
    const result = detectDraws(hole('Jc Ts'), parseCards('9d 7h 2c'));

    expect(result.outCount).toBe(4);
  });

  it('counts fifteen outs for the classic combo draw', () => {
    // Nine hearts, plus the queens and sevens that are not hearts.
    const result = detectDraws(hole('Jh Th'), parseCards('9h 8h 2d'));

    expect(result.outCount).toBe(15);
  });

  it('does not count a board pair, which helps every opponent equally', () => {
    // Ace-high with a flush draw: only the nine hearts are outs, not the aces,
    // fours and board-pairing cards that also lift hero's category.
    const result = detectDraws(hole('Ah 4h'), parseCards('Kh 8h 2c'));

    expect(result.outCount).toBe(9);
  });

  it('reports no outs when hero has neither a straight nor a flush draw', () => {
    const result = detectDraws(hole('Ac Kd'), parseCards('9s 5h 2c'));

    expect(result.outCount).toBe(0);
  });

  it('lists every out as a distinct card', () => {
    const result = detectDraws(hole('Jh Th'), parseCards('9h 8h 2d'));

    expect(new Set(result.outs).size).toBe(result.outs.length);
    expect(result.outCount).toBe(result.outs.length);
  });

  it('never counts a card already in play', () => {
    const known = [...hole('Jh Th'), ...parseCards('9h 8h 2d')];
    const result = detectDraws(hole('Jh Th'), parseCards('9h 8h 2d'));

    for (const out of result.outs) {
      expect(known).not.toContain(out);
    }
  });
});

describe('outsToEquity', () => {
  it('applies the rule of 2 and 4', () => {
    expect(outsToEquity(9, 2)).toBeCloseTo(0.36, 10);
    expect(outsToEquity(9, 1)).toBeCloseTo(0.18, 10);
  });

  it('never exceeds certainty', () => {
    expect(outsToEquity(30, 2)).toBe(1);
  });
});

describe('drawLabel', () => {
  it('names draws for the UI', () => {
    expect(drawLabel('flush')).toBe('Flush draw');
    expect(drawLabel('openEnded')).toBe('Open-ended straight draw');
    expect(drawLabel('gutshot')).toBe('Gutshot');
  });
});
