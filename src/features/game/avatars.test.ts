import { createRng } from '@/engine';

import { AVATARS, drawAvatars } from './avatars';

const SEED = 20260729;

describe('AVATARS', () => {
  it('holds ten faces, every one of them resolvable', () => {
    expect(AVATARS).toHaveLength(10);
    AVATARS.forEach((source) => expect(source).toBeDefined());
  });
});

describe('drawAvatars', () => {
  it('deals as many faces as asked for', () => {
    expect(drawAvatars(6, createRng(SEED))).toHaveLength(6);
  });

  it('never seats the same face twice', () => {
    // Every seed, not just a lucky one: a repeat reads as one opponent sitting
    // twice, so this is the property that matters.
    for (let seed = 0; seed < 200; seed++) {
      const drawn = drawAvatars(9, createRng(seed));

      expect(new Set(drawn).size).toBe(drawn.length);
    }
  });

  it('only ever returns indices into AVATARS', () => {
    for (const index of drawAvatars(10, createRng(SEED))) {
      expect(AVATARS[index]).toBeDefined();
    }
  });

  it('deals the same faces twice from the same seed', () => {
    expect(drawAvatars(5, createRng(SEED))).toEqual(drawAvatars(5, createRng(SEED)));
  });

  it('deals different faces from different seeds', () => {
    // Not a guarantee for any single pair, but these two seeds differ, and a
    // draw that ignored the rng would make this pass for every pair.
    expect(drawAvatars(8, createRng(1))).not.toEqual(drawAvatars(8, createRng(2)));
  });

  it('clamps a table bigger than the deck of faces rather than repeating one', () => {
    const drawn = drawAvatars(25, createRng(SEED));

    expect(drawn).toHaveLength(AVATARS.length);
    expect(new Set(drawn).size).toBe(AVATARS.length);
  });

  it('deals nothing for a table of nobody', () => {
    expect(drawAvatars(0, createRng(SEED))).toEqual([]);
    expect(drawAvatars(-3, createRng(SEED))).toEqual([]);
  });

  it('rounds a fractional count down', () => {
    expect(drawAvatars(3.7, createRng(SEED))).toHaveLength(3);
  });
});
