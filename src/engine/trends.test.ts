import { isMistake, mistakeRate, summarizeTrend, type TrendPoint } from './trends';

function point(overrides: Partial<TrendPoint> = {}): TrendPoint {
  return {
    key: 1,
    at: 1_000,
    handsPlayed: 10,
    decisionsGraded: 20,
    mistakes: 4,
    evLost: 60,
    net: -50,
    ...overrides,
  };
}

/** `count` buckets at a fixed rate per hundred decisions, an hour apart, oldest first. */
function run(count: number, ratePerHundred: number, from = 0): TrendPoint[] {
  return Array.from({ length: count }, (_, index) =>
    point({
      key: from + index,
      at: (from + index) * 3_600_000,
      decisionsGraded: 100,
      mistakes: ratePerHundred,
    }),
  );
}

describe('isMistake', () => {
  it('counts mistakes and blunders, and leaves marginal alone', () => {
    expect(isMistake('mistake')).toBe(true);
    expect(isMistake('blunder')).toBe(true);
    expect(isMistake('marginal')).toBe(false);
    expect(isMistake('correct')).toBe(false);
  });
});

describe('mistakeRate', () => {
  it('is mistakes per hundred decisions, weighted by how much was graded', () => {
    // 4 of 20 and 1 of 80: pooled, 5 of 100.
    const rate = mistakeRate([
      point({ decisionsGraded: 20, mistakes: 4 }),
      point({ decisionsGraded: 80, mistakes: 1 }),
    ]);

    expect(rate).toBeCloseTo(5, 6);
  });

  it('rates nothing at zero rather than at NaN', () => {
    expect(mistakeRate([])).toBe(0);
    expect(mistakeRate([point({ decisionsGraded: 0, mistakes: 0 })])).toBe(0);
  });
});

describe('summarizeTrend', () => {
  it('orders the buckets oldest first whatever order they arrive in', () => {
    const trend = summarizeTrend([point({ key: 3, at: 300 }), point({ key: 1, at: 100 })]);

    expect(trend.points.map((entry) => entry.key)).toEqual([1, 3]);
  });

  it('calls a falling rate improving', () => {
    const trend = summarizeTrend([...run(3, 40), ...run(3, 10, 3)]);

    expect(trend.earlierRate).toBeCloseTo(40, 6);
    expect(trend.recentRate).toBeCloseTo(10, 6);
    expect(trend.direction).toBe('improving');
  });

  it('calls a rising rate worsening', () => {
    const trend = summarizeTrend([...run(3, 10), ...run(3, 40, 3)]);

    expect(trend.direction).toBe('worsening');
  });

  it('does not call noise a direction', () => {
    // 20 per hundred to 24 is a fifth of the band's own quarter — nothing said.
    const trend = summarizeTrend([...run(3, 20), ...run(3, 24, 3)]);

    expect(trend.direction).toBe('steady');
  });

  it('does not let a tiny rate halve its way to a verdict', () => {
    // 2 per hundred to 1 is a 50% drop and two decisions; the floor catches it.
    expect(summarizeTrend([...run(3, 2), ...run(3, 1, 3)]).direction).toBe('steady');
  });

  it('refuses to read a direction out of too few sessions', () => {
    const trend = summarizeTrend([...run(1, 40), ...run(1, 0, 1)]);

    expect(trend.direction).toBe('unknown');
    // The rate itself is still honest; only the claim about travel is withheld.
    expect(trend.rate).toBeCloseTo(20, 6);
  });

  it('refuses to read a direction out of too few decisions', () => {
    const thin = Array.from({ length: 6 }, (_, index) =>
      point({ key: index, at: index, decisionsGraded: 5, mistakes: index < 3 ? 3 : 0 }),
    );

    expect(summarizeTrend(thin).direction).toBe('unknown');
  });

  it('measures rate, not volume: playing more is not playing worse', () => {
    const quiet = run(3, 20);
    const busy = run(3, 20, 3).map((entry) => ({
      ...entry,
      handsPlayed: entry.handsPlayed * 10,
      decisionsGraded: entry.decisionsGraded * 10,
      mistakes: entry.mistakes * 10,
    }));

    expect(summarizeTrend([...quiet, ...busy]).direction).toBe('steady');
  });

  it('has nothing to say about nothing', () => {
    const trend = summarizeTrend([]);

    expect(trend.points).toEqual([]);
    expect(trend.rate).toBe(0);
    expect(trend.direction).toBe('unknown');
  });
});
