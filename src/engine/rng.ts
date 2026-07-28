/**
 * Seeded pseudo-random number generation.
 *
 * Every source of randomness in the engine takes an `Rng` so simulations,
 * shuffles and bot decisions reproduce exactly from a seed. Hand replays and
 * the bot test harness both depend on that; `Math.random` is lint-banned inside
 * `src/engine`.
 */

export interface Rng {
  /** Next raw 32-bit unsigned integer. */
  nextUint32(): number;
  /** Next float in the half-open interval [0, 1). */
  next(): number;
  /** Uniform integer in [0, bound). Throws when `bound` is not a positive integer. */
  nextInt(bound: number): number;
}

/**
 * xoshiro128** — small, fast, and statistically far stronger than an LCG. Its
 * state is four 32-bit words, which suits JavaScript's integer operations.
 */
class Xoshiro128 implements Rng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number) {
    // splitmix32 expands a single seed into a well-distributed state; an
    // all-zero state would make the generator emit only zeroes.
    let x = seed >>> 0;
    const mix = (): number => {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
      return (z ^ (z >>> 15)) >>> 0;
    };

    this.s0 = mix();
    this.s1 = mix();
    this.s2 = mix();
    this.s3 = mix();

    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) {
      this.s0 = 1;
    }
  }

  nextUint32(): number {
    const result = (Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0) >>> 0;
    const t = (this.s1 << 9) >>> 0;

    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = rotl(this.s3, 11);

    return result;
  }

  next(): number {
    // 2^-32, so the result is in [0, 1).
    return this.nextUint32() * 2.3283064365386963e-10;
  }

  nextInt(bound: number): number {
    if (!Number.isInteger(bound) || bound <= 0) {
      throw new RangeError(`nextInt bound must be a positive integer, got ${bound}`);
    }

    // Rejection sampling: taking a plain modulus would bias the low values
    // whenever `bound` does not divide 2^32 evenly.
    const limit = Math.floor(0x100000000 / bound) * bound;
    let value = this.nextUint32();

    while (value >= limit) {
      value = this.nextUint32();
    }

    return value % bound;
  }
}

function rotl(value: number, shift: number): number {
  return (((value << shift) | (value >>> (32 - shift))) >>> 0) >>> 0;
}

/** Creates a deterministic generator. The same seed always yields the same sequence. */
export function createRng(seed: number): Rng {
  return new Xoshiro128(seed);
}
