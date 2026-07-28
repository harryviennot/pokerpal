import {
  applyBettingAction,
  isBettingRoundClosed,
  isLegalAction,
  legalActions,
  nextToAct,
} from './betting';
import { IllegalActionError, type HandState, type Player, type SeatIndex } from './table';

/**
 * Betting rules are tested against hand-built states rather than played-out
 * hands: the interesting cases (a shove three chips short of a full raise) take
 * one line to describe here and a dozen to reach through `hand.ts`.
 */
interface SeatSpec {
  stack: number;
  committed?: number;
  status?: Player['status'];
  acted?: boolean;
  mayRaise?: boolean;
}

function makeState(
  seats: readonly SeatSpec[],
  overrides: Partial<HandState> & { toAct: SeatIndex },
): HandState {
  const players: Player[] = seats.map((spec, seat) => ({
    seat,
    id: `p${seat}`,
    stack: spec.stack,
    holeCards: null,
    status: spec.status ?? (spec.stack === 0 ? 'allIn' : 'active'),
    committedThisStreet: spec.committed ?? 0,
    committedTotal: spec.committed ?? 0,
    hasActedThisStreet: spec.acted ?? false,
    mayRaiseThisStreet: spec.mayRaise ?? true,
  }));

  const currentBet = overrides.currentBet ?? Math.max(...players.map((p) => p.committedThisStreet));
  const lastRaiseSize = overrides.lastRaiseSize ?? 10;

  return {
    handNumber: 1,
    seed: 1,
    button: 0,
    blinds: { smallBlind: 5, bigBlind: 10 },
    players,
    street: 'flop',
    board: [],
    deck: [],
    currentBet,
    minRaiseTo: currentBet + lastRaiseSize,
    lastRaiseSize,
    pots: [],
    events: [],
    complete: false,
    ...overrides,
  };
}

describe('legalActions', () => {
  it('offers check or bet when nobody has bet', () => {
    const state = makeState([{ stack: 500 }, { stack: 500 }], { toAct: 0, currentBet: 0 });

    expect(legalActions(state)).toEqual([{ type: 'check' }, { type: 'bet', min: 10, max: 500 }]);
  });

  it('offers fold, call and raise when facing a bet', () => {
    const state = makeState([{ stack: 400, committed: 100 }, { stack: 500 }], {
      toAct: 1,
      currentBet: 100,
      lastRaiseSize: 100,
    });

    expect(legalActions(state)).toEqual([
      { type: 'fold' },
      { type: 'call', amount: 100 },
      { type: 'raise', min: 200, max: 500 },
    ]);
  });

  it('does not offer a fold when checking is free', () => {
    const state = makeState([{ stack: 500 }, { stack: 500 }], { toAct: 0, currentBet: 0 });

    expect(legalActions(state).some((action) => action.type === 'fold')).toBe(false);
  });

  it('caps a call at the stack of a short player', () => {
    const state = makeState([{ stack: 0, committed: 300, status: 'allIn' }, { stack: 80 }], {
      toAct: 1,
      currentBet: 300,
    });

    expect(legalActions(state)).toEqual([{ type: 'fold' }, { type: 'call', amount: 80 }]);
  });

  it('lets a short stack shove for less than a full raise', () => {
    // Facing 100 with 150 behind: a full raise to 200 is out of reach, but the
    // shove to 150 is still legal.
    const state = makeState([{ stack: 400, committed: 100 }, { stack: 150 }], {
      toAct: 1,
      currentBet: 100,
      lastRaiseSize: 100,
    });

    expect(legalActions(state)).toContainEqual({ type: 'raise', min: 150, max: 150 });
  });

  it('offers nothing to a seat with no chips behind', () => {
    const state = makeState([{ stack: 0, status: 'allIn' }, { stack: 500 }], { toAct: 0 });

    expect(legalActions(state)).toEqual([]);
  });

  it('offers nothing once the hand is complete', () => {
    const state = makeState([{ stack: 500 }, { stack: 500 }], { toAct: 0, complete: true });

    expect(legalActions(state)).toEqual([]);
  });
});

describe('minimum raise sizing', () => {
  it('sets the next minimum to the current price plus the raise increment', () => {
    const state = makeState(
      [
        { stack: 400, committed: 100 },
        { stack: 900, committed: 100 },
      ],
      {
        toAct: 1,
        currentBet: 100,
        lastRaiseSize: 100,
      },
    );

    const result = applyBettingAction(state, { type: 'raise', to: 250 });

    expect(result.currentBet).toBe(250);
    expect(result.lastRaiseSize).toBe(150);
    expect(result.minRaiseTo).toBe(400);
  });

  it('rejects a raise below the minimum', () => {
    const state = makeState([{ stack: 400, committed: 100 }, { stack: 900 }], {
      toAct: 1,
      currentBet: 100,
      lastRaiseSize: 100,
    });

    expect(() => applyBettingAction(state, { type: 'raise', to: 150 })).toThrow(IllegalActionError);
  });

  it('rejects a raise beyond the stack', () => {
    const state = makeState([{ stack: 400, committed: 100 }, { stack: 300 }], {
      toAct: 1,
      currentBet: 100,
      lastRaiseSize: 100,
    });

    expect(() => applyBettingAction(state, { type: 'raise', to: 400 })).toThrow(IllegalActionError);
  });

  it('treats the big blind as the minimum opening bet', () => {
    const state = makeState([{ stack: 500 }, { stack: 500 }], { toAct: 0, currentBet: 0 });

    expect(isLegalAction(state, { type: 'bet', to: 10 })).toBe(true);
    expect(isLegalAction(state, { type: 'bet', to: 9 })).toBe(false);
  });
});

describe('incomplete all-in raise', () => {
  // Seat 0 bet 100. Seat 1 shoves 140 — a raise of 40 where a full raise is
  // 100. Seat 2 has already called the 100.
  const shoveState = makeState(
    [
      { stack: 400, committed: 100, acted: true },
      { stack: 140 },
      { stack: 400, committed: 100, acted: true },
    ],
    { toAct: 1, currentBet: 100, lastRaiseSize: 100 },
  );

  const afterShove = applyBettingAction(shoveState, { type: 'raise', to: 140 });

  it('raises the price owed', () => {
    expect(afterShove.currentBet).toBe(140);
    expect(afterShove.allIn).toBe(true);
  });

  it('does not raise the minimum-raise increment', () => {
    expect(afterShove.lastRaiseSize).toBe(100);
    expect(afterShove.minRaiseTo).toBe(240);
  });

  it('forces players who already acted to answer the new price', () => {
    expect(afterShove.players[0]?.hasActedThisStreet).toBe(false);
    expect(afterShove.players[2]?.hasActedThisStreet).toBe(false);
  });

  it('does not reopen raising for players who already acted', () => {
    expect(afterShove.players[0]?.mayRaiseThisStreet).toBe(false);
    expect(afterShove.players[2]?.mayRaiseThisStreet).toBe(false);

    const next = makeState([{ stack: 400, committed: 100, acted: false, mayRaise: false }], {
      toAct: 0,
      currentBet: 140,
      lastRaiseSize: 100,
    });

    expect(legalActions(next).map((action) => action.type)).toEqual(['fold', 'call']);
  });

  it('leaves raising open to a player who had not yet acted', () => {
    const withWaiter = makeState(
      [{ stack: 400, committed: 100, acted: true }, { stack: 140 }, { stack: 400, acted: false }],
      { toAct: 1, currentBet: 100, lastRaiseSize: 100 },
    );

    const result = applyBettingAction(withWaiter, { type: 'raise', to: 140 });

    expect(result.players[2]?.mayRaiseThisStreet).toBe(true);
  });

  it('reopens raising for everyone once a full raise lands', () => {
    const reopened = makeState(
      [
        { stack: 400, committed: 100, acted: true, mayRaise: false },
        { stack: 0, committed: 140, status: 'allIn' },
        { stack: 600, committed: 100, acted: false },
      ],
      { toAct: 2, currentBet: 140, lastRaiseSize: 100 },
    );

    const result = applyBettingAction(reopened, { type: 'raise', to: 300 });

    expect(result.players[0]?.mayRaiseThisStreet).toBe(true);
    expect(result.players[0]?.hasActedThisStreet).toBe(false);
    expect(result.lastRaiseSize).toBe(160);
  });
});

describe('isBettingRoundClosed', () => {
  const players = (specs: readonly SeatSpec[], currentBet: number): boolean =>
    isBettingRoundClosed(makeState(specs, { toAct: 0, currentBet }).players, currentBet);

  it('is open while someone has not acted', () => {
    expect(players([{ stack: 500, acted: true }, { stack: 500 }], 0)).toBe(false);
  });

  it('closes when everyone has checked', () => {
    expect(
      players(
        [
          { stack: 500, acted: true },
          { stack: 500, acted: true },
        ],
        0,
      ),
    ).toBe(true);
  });

  it('closes when everyone has matched the bet', () => {
    expect(
      players(
        [
          { stack: 400, committed: 100, acted: true },
          { stack: 400, committed: 100, acted: true },
        ],
        100,
      ),
    ).toBe(true);
  });

  it('stays open while someone owes a call', () => {
    expect(
      players(
        [
          { stack: 400, committed: 100, acted: true },
          { stack: 400, committed: 40, acted: true },
        ],
        100,
      ),
    ).toBe(false);
  });

  it('closes when nobody has chips left to bet', () => {
    expect(
      players(
        [
          { stack: 0, committed: 400, status: 'allIn' },
          { stack: 0, committed: 400, status: 'allIn' },
        ],
        400,
      ),
    ).toBe(true);
  });

  it('closes when only one player is still contesting', () => {
    expect(players([{ stack: 500 }, { stack: 400, committed: 100, status: 'folded' }], 100)).toBe(
      true,
    );
  });
});

describe('nextToAct', () => {
  it('moves clockwise past folded and all-in seats', () => {
    const state = makeState(
      [
        { stack: 500, acted: true },
        { stack: 0, status: 'folded' },
        { stack: 0, committed: 300, status: 'allIn' },
        { stack: 500 },
      ],
      { toAct: 0, currentBet: 0 },
    );

    expect(nextToAct(state.players, 0, 0)).toBe(3);
  });

  it('wraps around the table', () => {
    const state = makeState([{ stack: 500 }, { stack: 500, acted: true }], {
      toAct: 1,
      currentBet: 0,
    });

    expect(nextToAct(state.players, 1, 0)).toBe(0);
  });

  it('returns null once the round is closed', () => {
    const state = makeState(
      [
        { stack: 500, acted: true },
        { stack: 500, acted: true },
      ],
      {
        toAct: 0,
        currentBet: 0,
      },
    );

    expect(nextToAct(state.players, 0, 0)).toBeNull();
  });
});
