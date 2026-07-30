import {
  formatChips,
  formatClock,
  formatPercent,
  formatPercentWhole,
  formatRatio,
  formatWhen,
  THIN_SPACE,
} from './format';

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

describe('formatPercentWhole', () => {
  it('renders a probability as a whole percentage', () => {
    expect(formatPercentWhole(0.284)).toBe('28%');
    expect(formatPercentWhole(0.415)).toBe('42%');
    expect(formatPercentWhole(0)).toBe('0%');
    expect(formatPercentWhole(1)).toBe('100%');
  });

  it('clamps values outside 0 to 1', () => {
    expect(formatPercentWhole(-0.5)).toBe('0%');
    expect(formatPercentWhole(1.5)).toBe('100%');
  });
});

describe('formatClock', () => {
  it('renders minutes and a zero-padded second', () => {
    expect(formatClock(47_000)).toBe('0:47');
    expect(formatClock(55_400)).toBe('0:55');
    expect(formatClock(9_514_000)).toBe('158:34');
  });

  it('counts minutes past an hour rather than rolling over', () => {
    expect(formatClock(3_600_000)).toBe('60:00');
  });

  it('truncates the part-second rather than rounding it up', () => {
    // A clock that showed 1:00 with a second still to run would be lying.
    expect(formatClock(59_999)).toBe('0:59');
  });

  it('never runs backwards', () => {
    expect(formatClock(-5_000)).toBe('0:00');
    expect(formatClock(Number.NaN)).toBe('0:00');
  });
});

describe('formatRatio', () => {
  it('renders one decimal followed by x', () => {
    expect(formatRatio(2.5)).toBe('2.5x');
    expect(formatRatio(10)).toBe('10.0x');
  });
});

describe('formatWhen', () => {
  it('renders month, day and a zero-padded minute', () => {
    // Built with the local-time constructor, so the expectation holds in any
    // timezone the test happens to run in.
    expect(formatWhen(new Date(2026, 6, 29, 14, 32).getTime())).toBe('Jul 29, 14:32');
    expect(formatWhen(new Date(2026, 0, 3, 9, 5).getTime())).toBe('Jan 3, 9:05');
  });
});
