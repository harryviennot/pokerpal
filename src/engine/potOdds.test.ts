import { analyzePotOdds, InvalidPotOddsError, potRaiseTo, requiredEquity } from './potOdds';

describe('potRaiseTo', () => {
  it('bets a fraction of the pot when there is nothing to call', () => {
    expect(potRaiseTo(1, 100, 0)).toBe(100);
    expect(potRaiseTo(0.5, 100, 0)).toBe(50);
    expect(potRaiseTo(0.75, 80, 0)).toBe(60);
  });

  it('calls first, then raises the pot the call has grown', () => {
    // The classic spot: 45 in the middle, 10 to call. A pot-sized raise is the
    // 10, then 55 on top — not a bet of 45.
    expect(potRaiseTo(1, 45, 10)).toBe(65);
    expect(potRaiseTo(0.5, 45, 10)).toBe(38);
  });

  it('adds what the raiser already has on the street', () => {
    // Having bet 20 and facing a raise to 60, the total commitment is what is
    // already out there plus the call plus the raise.
    expect(potRaiseTo(1, 120, 40, 20)).toBe(220);
  });

  it('rounds to whole chips', () => {
    expect(Number.isInteger(potRaiseTo(0.5, 45, 5))).toBe(true);
  });
});

describe('requiredEquity', () => {
  it('is the call divided by the pot after the call', () => {
    // Calling 25 into 100 risks 25 to win 125.
    expect(requiredEquity(100, 25)).toBeCloseTo(0.2, 10);
    expect(requiredEquity(100, 100)).toBeCloseTo(0.5, 10);
    expect(requiredEquity(100, 50)).toBeCloseTo(1 / 3, 10);
  });

  it('approaches zero as the bet shrinks', () => {
    expect(requiredEquity(1000, 1)).toBeLessThan(0.01);
  });

  it('handles a call into an empty pot', () => {
    expect(requiredEquity(0, 50)).toBe(1);
  });

  it('rejects impossible inputs', () => {
    expect(() => requiredEquity(-1, 10)).toThrow(InvalidPotOddsError);
    expect(() => requiredEquity(100, 0)).toThrow(InvalidPotOddsError);
    expect(() => requiredEquity(100, -5)).toThrow(InvalidPotOddsError);
    expect(() => requiredEquity(Number.NaN, 10)).toThrow(InvalidPotOddsError);
  });
});

describe('analyzePotOdds', () => {
  it('calls a profitable spot profitable', () => {
    const result = analyzePotOdds(100, 25, 0.35);

    expect(result.requiredEquity).toBeCloseTo(0.2, 10);
    expect(result.verdict).toBe('profitable');
    expect(result.edge).toBeCloseTo(0.15, 10);
  });

  it('calls an unprofitable spot unprofitable', () => {
    const result = analyzePotOdds(100, 100, 0.18);

    expect(result.verdict).toBe('unprofitable');
    expect(result.edge).toBeLessThan(0);
  });

  it('flags a spot near break-even as marginal rather than pretending to be sure', () => {
    expect(analyzePotOdds(100, 25, 0.205).verdict).toBe('marginal');
    expect(analyzePotOdds(100, 25, 0.195).verdict).toBe('marginal');
  });

  it('reports the ratio a player would say at the table', () => {
    // 100 in the pot, 25 to call: getting 4 to 1.
    expect(analyzePotOdds(100, 25, 0.3).oddsRatio).toBeCloseTo(4, 10);
  });

  it('computes expected value in chips', () => {
    // 35% of the time win 100, 65% of the time lose 25.
    const result = analyzePotOdds(100, 25, 0.35);

    expect(result.expectedValue).toBeCloseTo(0.35 * 100 - 0.65 * 25, 10);
  });

  it('breaks even exactly at the required equity', () => {
    const result = analyzePotOdds(100, 50, 1 / 3);

    expect(result.expectedValue).toBeCloseTo(0, 10);
    expect(result.verdict).toBe('marginal');
  });

  it('rejects an equity outside 0 to 1', () => {
    expect(() => analyzePotOdds(100, 25, 1.2)).toThrow(InvalidPotOddsError);
    expect(() => analyzePotOdds(100, 25, -0.1)).toThrow(InvalidPotOddsError);
  });
});
