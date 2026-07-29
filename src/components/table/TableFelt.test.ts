import { tableRadius } from './TableFelt';

describe('tableRadius', () => {
  it('draws a capsule on the tall practice felt', () => {
    // Half the short side, give or take the cap — the reference table shape.
    expect(tableRadius(360, 620)).toBeCloseTo(173.6, 1);
  });

  it('stops short of a lozenge on the replay screen', () => {
    // The replay screen fixes the felt at aspectRatio 0.85, where a true
    // capsule would round 358 points of width away to nothing.
    const radius = tableRadius(358, 421);

    expect(radius).toBeLessThan(358 / 2);
    expect(radius).toBeCloseTo(117.9, 1);
  });

  it('never exceeds half the short side, whatever the shape', () => {
    for (const [width, height] of [
      [300, 300],
      [400, 200],
      [200, 400],
      [360, 900],
    ]) {
      expect(tableRadius(width as number, height as number)).toBeLessThanOrEqual(
        Math.min(width as number, height as number) / 2,
      );
    }
  });
});
