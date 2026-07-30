import { boltPaths, SHEAR, slashPaths } from './arenaSlashes';

/** Every `M x y` move command in a path, as numbers. */
function moves(path: string): { x: number; y: number }[] {
  return [...path.matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
}

describe('slashPaths', () => {
  it('covers the whole screen, bottom-left corner included', () => {
    const width = 402;
    const height = 874;
    const all = Object.values(slashPaths(width, height)).join(' ');
    const starts = moves(all).map((point) => point.x);

    // A slash drifts `SHEAR * height` to the left on the way down, so the
    // rightmost one has to start beyond the edge by at least that much or the
    // bottom-right corner comes out bare.
    expect(Math.max(...starts)).toBeGreaterThan(width + SHEAR * height);
    expect(Math.min(...starts)).toBeLessThan(0);
  });

  it('leans every slash the same way', () => {
    const contours = slashPaths(400, 800).wash.split('Z').filter(Boolean);

    for (const contour of contours) {
      const points = [...contour.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((match) => ({
        x: Number(match[1]),
        y: Number(match[2]),
      }));
      const top = points[0];
      const bottom = points[3];

      expect(top).toBeDefined();
      expect(bottom).toBeDefined();
      expect(bottom!.x).toBeLessThan(top!.x);
      expect((top!.x - bottom!.x) / (bottom!.y - top!.y)).toBeCloseTo(SHEAR, 2);
    }
  });

  it('draws nothing before layout reports a size', () => {
    const paths = slashPaths(0, 0);

    // No tiles, so no contours — an empty path is a valid one to hand Skia.
    expect(paths.wash).toBe('');
    expect(paths.flare).toBe('');
    expect(paths.shadow).toBe('');
  });

  it('separates the tones so each can carry its own opacity', () => {
    const paths = slashPaths(400, 800);

    expect(paths.wash).not.toBe(paths.flare);
    expect(paths.shadow).not.toBe(paths.wash);
  });
});

describe('boltPaths', () => {
  it('draws both bolts inside the backdrop', () => {
    const path = boltPaths(400, 800);

    expect(moves(path)).toHaveLength(2);

    for (const point of [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)]) {
      expect(Number(point[1])).toBeGreaterThanOrEqual(0);
      expect(Number(point[1])).toBeLessThanOrEqual(400);
      expect(Number(point[2])).toBeGreaterThanOrEqual(0);
      expect(Number(point[2])).toBeLessThanOrEqual(800);
    }
  });
});
