import { legalActions } from './betting';
import { applyAction } from './hand';
import { createRng, type Rng } from './rng';
import {
  advanceToLevel,
  currentBlinds,
  finishHand,
  isSessionOver,
  sessionWinner,
  startNextHand,
  startSession,
  type SessionConfig,
  type SessionState,
} from './session';
import { InvalidTableError, type HandState } from './table';

const LEVELS = [
  { smallBlind: 5, bigBlind: 10 },
  { smallBlind: 10, bigBlind: 20 },
  { smallBlind: 25, bigBlind: 50 },
];

function config(stacks: readonly number[], overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    seats: stacks.map((stack, index) => ({ id: `p${index}`, stack })),
    style: 'sitAndGo',
    levels: LEVELS,
    seed: 2026,
    ...overrides,
  };
}

/** Plays a hand out with a random legal chooser so the session can move on. */
function playOut(hand: HandState, rng: Rng): HandState {
  let state = hand;

  while (!state.complete) {
    const legal = legalActions(state);
    const pick = legal[rng.nextInt(legal.length)];

    if (!pick) {
      throw new Error('no legal action');
    }

    state = applyAction(
      state,
      pick.type === 'bet' || pick.type === 'raise'
        ? { type: pick.type, to: pick.min }
        : { type: pick.type },
    );
  }

  return state;
}

/** Everyone folds to the big blind, which is the shortest legal hand. */
function foldAround(hand: HandState): HandState {
  let state = hand;

  while (!state.complete) {
    const legal = legalActions(state);
    const fold = legal.find((action) => action.type === 'fold');

    state = applyAction(state, fold ? { type: 'fold' } : { type: 'check' });
  }

  return state;
}

function playHand(session: SessionState, play = foldAround): SessionState {
  const { session: dealt, hand } = startNextHand(session);

  return finishHand(dealt, play(hand));
}

/** Empties a seat's stack, as if it had just lost its last chips. */
function bust(seats: SessionState['seats'], seat: number): SessionState['seats'] {
  return seats.map((s, index) => (index === seat ? { ...s, stack: 0 } : s));
}

describe('startSession', () => {
  it('starts before the first dealer so every hand moves the button the same way', () => {
    const session = startSession(config([1000, 1000, 1000]));
    const { hand } = startNextHand(session);

    expect(hand.button).toBe(0);
  });

  it('honours an explicit starting button', () => {
    const session = startSession(config([1000, 1000, 1000], { button: 0 }));
    const { hand } = startNextHand(session);

    expect(hand.button).toBe(1);
  });

  it('rejects a session that cannot play', () => {
    expect(() => startSession(config([1000]))).toThrow(InvalidTableError);
    expect(() => startSession(config([1000, 1000], { levels: [] }))).toThrow(InvalidTableError);
  });
});

describe('button movement', () => {
  it('moves one seat clockwise each hand and wraps', () => {
    let session = startSession(config([1000, 1000, 1000]));
    const buttons: number[] = [];

    for (let i = 0; i < 7; i++) {
      const { session: dealt, hand } = startNextHand(session);

      buttons.push(hand.button);
      session = finishHand(dealt, foldAround(hand));
    }

    expect(buttons).toEqual([0, 1, 2, 0, 1, 2, 0]);
  });

  it('skips a seat that has busted', () => {
    // Busting a seat by playing hands out takes a lot of setup for a rule that
    // is about seat selection, so the bust is stated directly.
    const started = startSession(config([1000, 1000, 1000], { button: 2 }));
    const session = { ...started, seats: bust(started.seats, 0) };

    const { hand } = startNextHand(session);

    expect(hand.button).toBe(1);
  });

  it('leaves the button where it is when only one seat can take it', () => {
    const started = startSession(config([1000, 1000, 1000], { button: 1 }));
    const session = { ...started, seats: bust(started.seats, 2) };

    const { hand } = startNextHand(session);

    expect(hand.button).toBe(0);
  });
});

describe('blind levels', () => {
  it('stays on the first level when no schedule is set', () => {
    let session = startSession(config([2000, 2000, 2000]));

    for (let i = 0; i < 5; i++) {
      session = playHand(session);
    }

    expect(currentBlinds(session)).toEqual(LEVELS[0]);
  });

  it('advances after the configured number of hands', () => {
    let session = startSession(config([5000, 5000, 5000], { handsPerLevel: 2 }));

    expect(currentBlinds(session)).toEqual(LEVELS[0]);

    session = playHand(session);
    expect(currentBlinds(session)).toEqual(LEVELS[0]);

    session = playHand(session);
    expect(currentBlinds(session)).toEqual(LEVELS[1]);

    session = playHand(session);
    session = playHand(session);
    expect(currentBlinds(session)).toEqual(LEVELS[2]);
  });

  it('stops at the last level rather than running off the schedule', () => {
    let session = startSession(config([20000, 20000, 20000], { handsPerLevel: 1 }));

    for (let i = 0; i < 8; i++) {
      session = playHand(session);
    }

    expect(currentBlinds(session)).toEqual(LEVELS[2]);
  });

  it('deals the hand at the level in force', () => {
    let session = startSession(config([5000, 5000, 5000], { handsPerLevel: 1 }));

    session = playHand(session);

    const { hand } = startNextHand(session);

    expect(hand.blinds).toEqual(LEVELS[1]);
  });
});

describe('advanceToLevel', () => {
  const started = (): SessionState => startSession(config([5000, 5000, 5000]));

  it('posts the new blinds on the next hand dealt', () => {
    const session = advanceToLevel(started(), 1);

    expect(currentBlinds(session)).toEqual(LEVELS[1]);
    expect(startNextHand(session).hand.blinds).toEqual(LEVELS[1]);
  });

  it('clamps to the top of the ladder rather than running off it', () => {
    const session = advanceToLevel(started(), 99);

    expect(session.level).toBe(LEVELS.length - 1);
    expect(currentBlinds(session)).toEqual(LEVELS[2]);
    expect(startNextHand(session).hand.blinds).toEqual(LEVELS[2]);
  });

  it('never moves backwards, and hands back the same session when there is nothing to do', () => {
    const raised = advanceToLevel(started(), 2);

    // Identity, not equality: a wall clock calls this on every tick, and an
    // allocation per tick is a re-render per tick for anything watching.
    expect(advanceToLevel(raised, 0)).toBe(raised);
    expect(advanceToLevel(raised, -5)).toBe(raised);
    expect(advanceToLevel(raised, 2)).toBe(raised);
    expect(advanceToLevel(raised, Number.NaN)).toBe(raised);
  });

  it('leaves everything else about the session where it was', () => {
    const played = playHand(started());
    const raised = advanceToLevel(played, 1);

    expect(raised.level).toBe(1);
    expect(raised.handsPlayed).toBe(played.handsPlayed);
    expect(raised.button).toBe(played.button);
    expect(raised.over).toBe(played.over);
    expect(raised.seats).toBe(played.seats);
    expect(raised.history).toBe(played.history);
  });

  it('sits on top of a hands-per-level schedule without walking it back down', () => {
    // The clock has already raised the blinds once; the hand counter picks up
    // from there on its next boundary instead of resetting to level one.
    let session = advanceToLevel(startSession(config([5000, 5000, 5000], { handsPerLevel: 2 })), 1);

    session = playHand(session);
    expect(currentBlinds(session)).toEqual(LEVELS[1]);

    session = playHand(session);
    expect(currentBlinds(session)).toEqual(LEVELS[2]);
  });
});

describe('sit-and-go', () => {
  it('ends when one player holds every chip', () => {
    const rng = createRng(11);
    let session = startSession(config([300, 300, 300], { handsPerLevel: 3 }));
    let guard = 0;

    while (!isSessionOver(session) && guard++ < 500) {
      session = playHand(session, (hand) => playOut(hand, rng));
    }

    expect(isSessionOver(session)).toBe(true);

    const winner = sessionWinner(session);

    expect(winner).not.toBeNull();
    expect(winner?.stack).toBe(900);
    expect(session.seats.filter((seat) => seat.stack > 0)).toHaveLength(1);
  });

  it('refuses to deal once it is over', () => {
    const rng = createRng(3);
    let session = startSession(config([200, 200]));
    let guard = 0;

    while (!isSessionOver(session) && guard++ < 500) {
      session = playHand(session, (hand) => playOut(hand, rng));
    }

    expect(() => startNextHand(session)).toThrow(InvalidTableError);
  });

  it('keeps chips constant across the whole session', () => {
    const rng = createRng(77);
    let session = startSession(config([500, 500, 500, 500]));
    let guard = 0;

    while (!isSessionOver(session) && guard++ < 500) {
      session = playHand(session, (hand) => playOut(hand, rng));

      expect(session.seats.reduce((sum, seat) => sum + seat.stack, 0)).toBe(2000);
    }
  });
});

describe('cash game', () => {
  it('buys a busted player back in and never ends on its own', () => {
    const rng = createRng(5);
    let session = startSession(
      config([1000, 1000, 60], { style: 'cash', rebuyTo: 1000, handsPerLevel: 2 }),
    );

    for (let i = 0; i < 40; i++) {
      session = playHand(session, (hand) => playOut(hand, rng));
    }

    expect(isSessionOver(session)).toBe(false);
    expect(session.seats.every((seat) => seat.stack > 0)).toBe(true);
    expect(session.handsPlayed).toBe(40);
  });

  it('tops a busted seat back up to the rebuy amount', () => {
    const started = startSession(config([1000, 1000, 1000], { style: 'cash', rebuyTo: 500 }));
    const session = { ...started, seats: bust(started.seats, 1) };

    const { session: dealt, hand } = startNextHand(session);

    expect(dealt.seats[1]?.stack).toBe(500);
    // The rebuy happens before the deal, so the seat is dealt in with chips.
    expect(hand.players[1]?.status).not.toBe('sittingOut');
  });

  it('keeps a busted seat in the hand order rather than reindexing the table', () => {
    const started = startSession(config([1000, 1000, 1000], { handsPerLevel: 1 }));
    const session = { ...started, seats: bust(started.seats, 0) };

    const { hand } = startNextHand(session);

    expect(hand.players).toHaveLength(3);
    expect(hand.players[0]?.status).toBe('sittingOut');
    expect(hand.players[0]?.holeCards).toBeNull();
  });
});

describe('hand history', () => {
  it('records every hand with its seed, button and net results', () => {
    let session = startSession(config([1000, 1000, 1000]));

    session = playHand(session);
    session = playHand(session);

    expect(session.history).toHaveLength(2);

    const [first] = session.history;

    expect(first?.handNumber).toBe(1);
    expect(first?.button).toBe(0);
    expect(first?.blinds).toEqual(LEVELS[0]);
    expect(first?.events.length).toBeGreaterThan(0);
    // Folding around: the small blind loses 5, the big blind wins it.
    expect(first?.results).toEqual([0, -5, 5]);
    expect(first?.results.reduce((sum, net) => sum + net, 0)).toBe(0);
  });

  it('gives each hand a distinct seed drawn from the session', () => {
    let session = startSession(config([2000, 2000, 2000]));

    for (let i = 0; i < 5; i++) {
      session = playHand(session);
    }

    const seeds = session.history.map((record) => record.seed);

    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it('replays the same session from the same seed', () => {
    const run = (): number[] => {
      const rng = createRng(1234);
      let session = startSession(config([400, 400, 400], { seed: 8888 }));
      let guard = 0;

      while (!isSessionOver(session) && guard++ < 200) {
        session = playHand(session, (hand) => playOut(hand, rng));
      }

      return session.seats.map((seat) => seat.stack);
    };

    expect(run()).toEqual(run());
  });
});

describe('finishHand', () => {
  it('refuses a hand that is still in progress', () => {
    const session = startSession(config([1000, 1000, 1000]));
    const { session: dealt, hand } = startNextHand(session);

    expect(() => finishHand(dealt, hand)).toThrow(InvalidTableError);
  });
});
