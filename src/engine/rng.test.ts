import { createRng } from './rng';

describe('createRng', () => {
  it('reproduces the same sequence from the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const drawsA = Array.from({ length: 100 }, () => a.nextUint32());
    const drawsB = Array.from({ length: 100 }, () => b.nextUint32());

    expect(drawsA).toEqual(drawsB);
  });

  it('produces different sequences for different seeds', () => {
    const draw = (seed: number): number[] => {
      const rng = createRng(seed);

      return Array.from({ length: 50 }, () => rng.nextUint32());
    };

    expect(draw(1)).not.toEqual(draw(2));
  });

  it('survives a zero seed rather than emitting only zeroes', () => {
    const rng = createRng(0);
    const draws = Array.from({ length: 20 }, () => rng.nextUint32());

    expect(new Set(draws).size).toBeGreaterThan(1);
  });

  it('emits 32-bit unsigned integers', () => {
    const rng = createRng(7);

    for (let i = 0; i < 1000; i++) {
      const value = rng.nextUint32();

      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('emits floats in [0, 1)', () => {
    const rng = createRng(99);

    for (let i = 0; i < 10_000; i++) {
      const value = rng.next();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('nextInt', () => {
  it('stays within the bound', () => {
    const rng = createRng(3);

    for (let i = 0; i < 10_000; i++) {
      const value = rng.nextInt(52);

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(52);
    }
  });

  it('always returns zero for a bound of one', () => {
    const rng = createRng(5);

    for (let i = 0; i < 100; i++) {
      expect(rng.nextInt(1)).toBe(0);
    }
  });

  it('distributes roughly uniformly', () => {
    const rng = createRng(11);
    const buckets = new Array<number>(6).fill(0);
    const draws = 60_000;

    for (let i = 0; i < draws; i++) {
      buckets[rng.nextInt(6)]!++;
    }

    const expected = draws / 6;

    for (const count of buckets) {
      // Well inside the noise floor for 60k draws; catches modulo bias.
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.05);
    }
  });

  it('rejects bounds that are not positive integers', () => {
    const rng = createRng(1);

    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-3)).toThrow(RangeError);
    expect(() => rng.nextInt(2.5)).toThrow(RangeError);
  });
});
