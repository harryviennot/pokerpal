import { formatChips, formatPercent, formatRatio, THIN_SPACE } from './format';

describe('formatPercent', () => {
  it('renders a probability with one decimal', () => {
    expect(formatPercent(0.8194)).toBe('81.9%');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(1)).toBe('100.0%');
  });

  it('rounds to one decimal rather than truncating', () => {
    expect(formatPercent(0.12349)).toBe('12.3%');
    expect(formatPercent(0.12351)).toBe('12.4%');
  });

  it('clamps values outside 0 to 1', () => {
    expect(formatPercent(-0.5)).toBe('0.0%');
    expect(formatPercent(1.5)).toBe('100.0%');
  });
});

describe('formatChips', () => {
  it('groups thousands with a thin space', () => {
    expect(formatChips(12500)).toBe(`12${THIN_SPACE}500`);
    expect(formatChips(1000000)).toBe(`1${THIN_SPACE}000${THIN_SPACE}000`);
  });

  it('leaves values under a thousand ungrouped', () => {
    expect(formatChips(0)).toBe('0');
    expect(formatChips(999)).toBe('999');
  });

  it('handles negative stacks', () => {
    expect(formatChips(-2500)).toBe(`-2${THIN_SPACE}500`);
  });

  it('rounds fractional chips', () => {
    expect(formatChips(1499.6)).toBe(`1${THIN_SPACE}500`);
  });
});

describe('formatRatio', () => {
  it('renders one decimal followed by x', () => {
    expect(formatRatio(2.5)).toBe('2.5x');
    expect(formatRatio(10)).toBe('10.0x');
  });
});
