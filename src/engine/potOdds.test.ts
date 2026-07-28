import { analyzePotOdds, InvalidPotOddsError, requiredEquity } from './potOdds';

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
