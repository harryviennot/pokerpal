import { formatCard, parseCard } from '@/engine';

import { buildClassTable, DEFAULT_CLASS_NAMES, InvalidCardError } from './classMap';

describe('DEFAULT_CLASS_NAMES', () => {
  it('lists all 52 cards exactly once', () => {
    expect(DEFAULT_CLASS_NAMES).toHaveLength(52);
    expect(new Set(DEFAULT_CLASS_NAMES).size).toBe(52);
  });

  it('is alphabetical, as the public models export their labels', () => {
    const sorted = [...DEFAULT_CLASS_NAMES].sort();

    expect(DEFAULT_CLASS_NAMES).toEqual(sorted);
  });
});

describe('buildClassTable', () => {
  it('maps class names to the cards they spell', () => {
    const table = buildClassTable(DEFAULT_CLASS_NAMES);

    expect(table[DEFAULT_CLASS_NAMES.indexOf('10C')]).toBe(parseCard('Tc'));
    expect(table[DEFAULT_CLASS_NAMES.indexOf('AS')]).toBe(parseCard('As'));
    expect(table[DEFAULT_CLASS_NAMES.indexOf('7H')]).toBe(parseCard('7h'));
  });

  it('covers the whole deck', () => {
    const table = buildClassTable(DEFAULT_CLASS_NAMES);

    expect(new Set(table.map(formatCard)).size).toBe(52);
  });

  it('rejects a label that is not a card', () => {
    expect(() => buildClassTable(['joker'])).toThrow(InvalidCardError);
  });
});
