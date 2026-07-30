import {
  betPresets,
  clampToBand,
  stepRaise,
  type BetPreset,
  type BetPresetInput,
} from './betPresets';

/**
 * The preflop spot in the reference screenshot: the hero on the button facing a
 * big blind of 20 with a small blind already in, so 30 in the pot and 20 to call.
 * Its four presets are `All-in`, `70 / Pot`, `60 / x3.0`, `50 / x2.5`.
 */
const PREFLOP: BetPresetInput = {
  pot: 30,
  toCall: 20,
  committed: 0,
  bigBlind: 20,
  min: 40,
  max: 500,
  street: 'preflop',
};

/**
 * The postflop spot in the reference screenshot: 40 in the pot, nothing to call,
 * a big blind of 20. Its presets are `All-in`, `40 / Pot`, `26 / 65 %` and a
 * greyed-out `14 / 35 %` — below the minimum bet.
 */
const POSTFLOP: BetPresetInput = {
  pot: 40,
  toCall: 0,
  committed: 0,
  bigBlind: 20,
  min: 20,
  max: 750,
  street: 'flop',
};

const amounts = (presets: readonly BetPreset[]): number[] => presets.map((preset) => preset.amount);

const captions = (presets: readonly BetPreset[]): (string | null)[] =>
  presets.map((preset) => preset.caption);

describe('betPresets before the flop', () => {
  it('offers the shove, the pot and two opens in big blinds', () => {
    const presets = betPresets(PREFLOP);

    expect(amounts(presets)).toEqual([500, 70, 60, 50]);
    expect(captions(presets)).toEqual([null, 'Pot', 'x3.0', 'x2.5']);
  });

  it('stacks them largest first, the way the console reads down the column', () => {
    expect(amounts(betPresets(PREFLOP))).toEqual(
      [...amounts(betPresets(PREFLOP))].sort((a, b) => b - a),
    );
  });

  it('quotes an open against the big blind, not the pot', () => {
    // Doubling the pot leaves the two opens where they were: that is the whole
    // reason preflop has a vocabulary of its own.
    const bigger = betPresets({ ...PREFLOP, pot: 300 });

    expect(bigger.find((preset) => preset.id === 'large')?.amount).toBe(60);
    expect(bigger.find((preset) => preset.id === 'small')?.amount).toBe(50);
  });

  it('scales the opens with the blind level', () => {
    const raised = betPresets({ ...PREFLOP, bigBlind: 60 });

    expect(raised.find((preset) => preset.id === 'large')?.amount).toBe(180);
    expect(raised.find((preset) => preset.id === 'small')?.amount).toBe(150);
  });
});

describe('betPresets after the flop', () => {
  it('offers the shove and three fractions of the pot', () => {
    const presets = betPresets(POSTFLOP);

    expect(amounts(presets)).toEqual([750, 40, 26, 14]);
    expect(captions(presets)).toEqual([null, 'Pot', '65%', '35%']);
  });

  it('counts the call into a pot-sized raise', () => {
    // A pot-sized raise is not a bet of the pot: the raiser calls first, and the
    // pot they are raising has grown by that call.
    const facing = betPresets({ ...POSTFLOP, toCall: 40, pot: 80, min: 80 });

    expect(facing.find((preset) => preset.id === 'pot')?.amount).toBe(160);
  });

  it('adds what is already out on the street to the total', () => {
    const halfway = betPresets({ ...POSTFLOP, committed: 20, pot: 60 });

    expect(halfway.find((preset) => preset.id === 'pot')?.amount).toBe(80);
  });
});

describe('betPresets legality', () => {
  it('disables a size the rules will not take, and shows it anyway', () => {
    // 35% of a 40 pot is 14, and the smallest legal bet is a big blind of 20.
    const small = betPresets(POSTFLOP).find((preset) => preset.id === 'small');

    expect(small?.amount).toBe(14);
    expect(small?.enabled).toBe(false);
  });

  it('disables a size above the hero stack rather than clamping it to a shove', () => {
    const short = betPresets({ ...PREFLOP, max: 55 });

    expect(short.find((preset) => preset.id === 'pot')).toMatchObject({
      amount: 70,
      enabled: false,
    });
    expect(short.find((preset) => preset.id === 'large')).toMatchObject({
      amount: 60,
      enabled: false,
    });
    expect(short.find((preset) => preset.id === 'small')).toMatchObject({
      amount: 50,
      enabled: true,
    });
  });

  it('always leaves the shove available, even when it is the only size left', () => {
    const forced = betPresets({ ...PREFLOP, min: 500, max: 500 });

    expect(forced.find((preset) => preset.id === 'allIn')).toMatchObject({
      amount: 500,
      enabled: true,
    });
    expect(forced.filter((preset) => preset.enabled)).toHaveLength(1);
  });

  it('never enables a size outside the band, whatever the spot', () => {
    for (const input of [PREFLOP, POSTFLOP, { ...POSTFLOP, street: 'river' as const }]) {
      for (const preset of betPresets(input)) {
        expect(preset.enabled).toBe(preset.amount >= input.min && preset.amount <= input.max);
      }
    }
  });
});

describe('stepRaise', () => {
  it('nudges by a blind in either direction', () => {
    expect(stepRaise(60, 20, 40, 500)).toBe(80);
    expect(stepRaise(60, -20, 40, 500)).toBe(40);
  });

  it('stops at the shove rather than going dead', () => {
    expect(stepRaise(490, 20, 40, 500)).toBe(500);
    expect(stepRaise(500, 20, 40, 500)).toBe(500);
  });

  it('stops at the minimum rather than offering an illegal raise', () => {
    expect(stepRaise(50, -20, 40, 500)).toBe(40);
    expect(stepRaise(40, -20, 40, 500)).toBe(40);
  });
});

describe('clampToBand', () => {
  it('holds a size inside the band the rules gave', () => {
    expect(clampToBand(10, 40, 500)).toBe(40);
    expect(clampToBand(900, 40, 500)).toBe(500);
    expect(clampToBand(120, 40, 500)).toBe(120);
  });
});
