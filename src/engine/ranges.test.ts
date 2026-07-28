import { formatCard, rankOf, suitOf } from './cards';
import {
  allCombos,
  expandHandToken,
  expandRange,
  InvalidRangeError,
  presetRange,
  rangeFraction,
  type Combo,
} from './ranges';

const describeCombo = (combo: Combo): string => combo.map(formatCard).join('');

describe('expandHandToken', () => {
  it('expands a pair into six combinations', () => {
    const combos = expandHandToken('AA');

    expect(combos).toHaveLength(6);
    for (const combo of combos) {
      expect(rankOf(combo[0])).toBe(14);
      expect(rankOf(combo[1])).toBe(14);
      expect(suitOf(combo[0])).not.toBe(suitOf(combo[1]));
    }
  });

  it('expands a suited hand into four combinations', () => {
    const combos = expandHandToken('AKs');

    expect(combos).toHaveLength(4);
    for (const combo of combos) {
      expect(suitOf(combo[0])).toBe(suitOf(combo[1]));
    }
  });

  it('expands an offsuit hand into twelve combinations', () => {
    const combos = expandHandToken('AKo');

    expect(combos).toHaveLength(12);
    for (const combo of combos) {
      expect(suitOf(combo[0])).not.toBe(suitOf(combo[1]));
    }
  });

  it('is case-insensitive', () => {
    expect(expandHandToken('aks').map(describeCombo)).toEqual(
      expandHandToken('AKs').map(describeCombo),
    );
  });

  it('never produces a duplicate combination', () => {
    for (const token of ['AA', 'AKs', 'AKo', '72o', 'T9s']) {
      const combos = expandHandToken(token).map(describeCombo);

      expect(new Set(combos).size).toBe(combos.length);
    }
  });

  it('rejects malformed tokens rather than guessing', () => {
    for (const bad of ['', 'A', 'AAs', 'AAo', 'AK', 'AXs', 'AKx', '11s']) {
      expect(() => expandHandToken(bad)).toThrow(InvalidRangeError);
    }
  });
});

describe('expandRange', () => {
  it('accepts whitespace and commas', () => {
    expect(expandRange('AA, KK  QQ')).toHaveLength(18);
  });

  it('returns nothing for an empty string', () => {
    expect(expandRange('   ')).toHaveLength(0);
  });
});

describe('presets', () => {
  it('orders the presets from tightest to loosest', () => {
    const tight = presetRange('tight').length;
    const standard = presetRange('standard').length;
    const loose = presetRange('loose').length;

    expect(tight).toBeLessThan(standard);
    expect(standard).toBeLessThan(loose);
  });

  it('keeps each preset in a believable band of all starting hands', () => {
    // A nit opens ~4%, a solid TAG ~13%, a calling station ~40%.
    expect(rangeFraction(presetRange('tight'))).toBeGreaterThan(0.02);
    expect(rangeFraction(presetRange('tight'))).toBeLessThan(0.07);
    expect(rangeFraction(presetRange('standard'))).toBeGreaterThan(0.1);
    expect(rangeFraction(presetRange('standard'))).toBeLessThan(0.2);
    expect(rangeFraction(presetRange('loose'))).toBeGreaterThan(0.33);
    expect(rangeFraction(presetRange('loose'))).toBeLessThan(0.5);
  });

  it('contains aces in every preset', () => {
    for (const preset of ['tight', 'standard', 'loose'] as const) {
      const hasAces = presetRange(preset).some(
        (combo) => rankOf(combo[0]) === 14 && rankOf(combo[1]) === 14,
      );

      expect(hasAces).toBe(true);
    }
  });

  it('contains no duplicate combinations', () => {
    for (const preset of ['tight', 'standard', 'loose'] as const) {
      const combos = presetRange(preset).map(describeCombo);

      expect(new Set(combos).size).toBe(combos.length);
    }
  });

  it('returns a cached array on repeated calls', () => {
    expect(presetRange('tight')).toBe(presetRange('tight'));
  });
});

describe('allCombos', () => {
  it('enumerates the 1326 possible starting hands', () => {
    const combos = allCombos();

    expect(combos).toHaveLength(1326);
    expect(new Set(combos.map(describeCombo)).size).toBe(1326);
    expect(rangeFraction(combos)).toBe(1);
  });
});
