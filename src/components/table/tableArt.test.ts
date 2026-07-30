import {
  arenaFrame,
  ARENA_CAPSULE,
  CAPSULE_CAP_DEPTH,
  capsuleHalfWidth,
  capsuleRect,
  TABLE_ASPECT,
} from './tableArt';

describe('ARENA_CAPSULE', () => {
  it('matches the measured alpha bounds of the artwork', () => {
    // Guards the constants against a re-export of the asset: alpha > 250 spans
    // x=249, y=156, 525x1175 of the 1024x1536 image.
    expect(ARENA_CAPSULE.x).toBeCloseTo(0.2432, 4);
    expect(ARENA_CAPSULE.y).toBeCloseTo(0.1016, 4);
    expect(ARENA_CAPSULE.width).toBeCloseTo(0.5127, 4);
    expect(ARENA_CAPSULE.height).toBeCloseTo(0.765, 4);
  });
});

describe('arenaFrame', () => {
  it('places the capsule exactly on the requested rect', () => {
    const capsule = { width: 370, height: 571 };
    const frame = arenaFrame(capsule);

    // Re-derive where the capsule lands inside the drawn frame; it has to come
    // back out at (0, 0) with the size that was asked for.
    expect(frame.left + ARENA_CAPSULE.x * frame.width).toBeCloseTo(0, 6);
    expect(frame.top + ARENA_CAPSULE.y * frame.height).toBeCloseTo(0, 6);
    expect(ARENA_CAPSULE.width * frame.width).toBeCloseTo(capsule.width, 6);
    expect(ARENA_CAPSULE.height * frame.height).toBeCloseTo(capsule.height, 6);
  });

  it('draws the image bigger than the capsule, hanging outside on every side', () => {
    const frame = arenaFrame({ width: 300, height: 400 });

    expect(frame.width).toBeGreaterThan(300);
    expect(frame.height).toBeGreaterThan(400);
    expect(frame.left).toBeLessThan(0);
    expect(frame.top).toBeLessThan(0);
  });

  it('collapses to nothing before layout reports a size', () => {
    const frame = arenaFrame({ width: 0, height: 0 });

    expect(frame.width).toBeCloseTo(0, 12);
    expect(frame.height).toBeCloseTo(0, 12);
    expect(frame.left).toBeCloseTo(0, 12);
    expect(frame.top).toBeCloseTo(0, 12);
  });
});

describe('capsuleRect', () => {
  it('fills the width of a tall phone screen, minus the margin', () => {
    const rect = capsuleRect({ width: 402, height: 740 }, 16);

    expect(rect.width).toBeCloseTo(370, 6);
    expect(rect.height).toBeCloseTo(370 / TABLE_ASPECT, 6);
    expect(rect.left).toBeCloseTo(16, 6);
  });

  it('fits by height on the tracker felt, where the box is nearly square', () => {
    const box = { width: 370, height: 435 };
    const rect = capsuleRect(box, 16);

    expect(rect.height).toBeCloseTo(435 - 32, 6);
    expect(rect.width).toBeLessThan(box.width - 32);
    // Centred in what is left over on the long axis.
    expect(rect.left).toBeCloseTo((box.width - rect.width) / 2, 6);
  });

  it('keeps the reference shape and stays inside the box at any size', () => {
    for (const box of [
      { width: 320, height: 500 },
      { width: 402, height: 874 },
      { width: 430, height: 420 },
      { width: 700, height: 400 },
    ]) {
      const rect = capsuleRect(box, 16);

      expect(rect.width / rect.height).toBeCloseTo(TABLE_ASPECT, 6);
      expect(rect.left).toBeGreaterThanOrEqual(16 - 1e-9);
      expect(rect.top).toBeGreaterThanOrEqual(16 - 1e-9);
      expect(rect.left + rect.width).toBeLessThanOrEqual(box.width - 16 + 1e-9);
      expect(rect.top + rect.height).toBeLessThanOrEqual(box.height - 16 + 1e-9);
    }
  });

  it('never returns a negative size for a box smaller than its margins', () => {
    expect(capsuleRect({ width: 10, height: 10 }, 16).width).toBe(0);
  });
});

describe('capsuleHalfWidth', () => {
  it('is full width along the straight sides', () => {
    expect(capsuleHalfWidth(0.5)).toBe(0.5);
    expect(capsuleHalfWidth(CAPSULE_CAP_DEPTH)).toBe(0.5);
    expect(capsuleHalfWidth(1 - CAPSULE_CAP_DEPTH)).toBe(0.5);
  });

  it('pinches to nothing at the very ends', () => {
    expect(capsuleHalfWidth(0)).toBe(0);
    expect(capsuleHalfWidth(1)).toBe(0);
  });

  it('widens monotonically through the cap and is symmetric end to end', () => {
    let previous = 0;

    for (let depth = 0.01; depth < CAPSULE_CAP_DEPTH; depth += 0.01) {
      const half = capsuleHalfWidth(depth);

      expect(half).toBeGreaterThan(previous);
      expect(half).toBeCloseTo(capsuleHalfWidth(1 - depth), 12);
      previous = half;
    }
  });

  it('is half the width at the widest point of a circular cap', () => {
    // The cap is an ellipse with semi-axes 0.5 and CAPSULE_CAP_DEPTH, so at
    // half the cap's depth it has reached sqrt(3)/2 of full width.
    expect(capsuleHalfWidth(CAPSULE_CAP_DEPTH / 2)).toBeCloseTo((0.5 * Math.sqrt(3)) / 2, 6);
  });
});
