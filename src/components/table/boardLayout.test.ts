import { boardCardSize, boardWidth } from './boardLayout';

describe('boardCardSize', () => {
  it('uses the full-size card on a phone-sized felt', () => {
    // A 402-point screen, padded by the host screen, gives the capsule around
    // 362 points across.
    expect(boardCardSize(362)).toBe('large');
  });

  it('steps down so the river still fits the tracker felt', () => {
    // The replay screen fixes the felt at aspectRatio 0.85, which leaves the
    // capsule around 277 points wide.
    expect(boardCardSize(277)).toBe('medium');
  });

  it('always returns a size whose board fits, or the smallest there is', () => {
    for (let width = 80; width <= 500; width += 4) {
      const size = boardCardSize(width);

      expect(boardWidth(size) <= width || size === 'small').toBe(true);
    }
  });

  it('never grows the board as the felt shrinks', () => {
    let previous = Number.POSITIVE_INFINITY;

    for (let width = 500; width >= 80; width -= 4) {
      const current = boardWidth(boardCardSize(width));

      expect(current).toBeLessThanOrEqual(previous);
      previous = current;
    }
  });
});
