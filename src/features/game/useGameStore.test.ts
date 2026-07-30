import {
  bySeat,
  createRng,
  legalActions,
  makeBot,
  playUntilSeat,
  reviewHand,
  ROCK,
  startNextHand,
  startSession,
  type Action,
  type HandState,
} from '@/engine';
import { installMemoryHandHistoryRepo } from '@/services/handHistory';

import { GRADE_ITERATIONS, tableConfigOf } from './grading';
import { DECISION_CLOCK_MS, LEVEL_LENGTH_MS } from './pacing';
import { DEFAULT_GAME_SETUP, seatsFor, toSessionConfig, type GameSetup } from './tableSetup';
import { type ActiveGame, type GamePhase } from './types';
import { BOT_SEED_OFFSET, HERO_SEAT, useGameStore } from './useGameStore';

/** The table these assertions were written against. */
const SEED = 20260728;

const read = () => useGameStore.getState();

function live(): ActiveGame {
  const game = read().game;

  if (!game) {
    throw new Error('There is no game.');
  }

  return game;
}

function setup(overrides: Partial<GameSetup> = {}): GameSetup {
  return { ...DEFAULT_GAME_SETUP, ...overrides };
}

/**
 * Runs the clock in small steps until the table gets where it is going.
 *
 * Small steps rather than one jump because the pump schedules the next timer from
 * inside the last one: the point of every test here is that the game arrives in
 * pieces, so the clock has to be turned rather than skipped.
 */
function advanceUntil(reached: () => boolean, budgetMs = 120_000): void {
  const stepMs = 100;

  for (let elapsed = 0; elapsed < budgetMs && !reached(); elapsed += stepMs) {
    jest.advanceTimersByTime(stepMs);
  }

  if (!reached()) {
    throw new Error(`The table never got there; it is ${live().phase}.`);
  }
}

/** The hero as a calling station: it never folds while there is a cheaper option. */
function passive(hand: HandState): Action {
  const legal = legalActions(hand);

  if (legal.some((action) => action.type === 'check')) {
    return { type: 'check' };
  }

  return legal.some((action) => action.type === 'call') ? { type: 'call' } : { type: 'fold' };
}

/** Plays the hero passively, a decision at a time, until `reached`. */
function playUntil(reached: () => boolean, budgetMs = 120_000): void {
  for (let decision = 0; decision < 300; decision++) {
    if (reached()) {
      return;
    }

    advanceUntil(() => reached() || live().phase === 'heroTurn', budgetMs);

    if (reached()) {
      return;
    }

    read().act(passive(live().hand));
  }

  throw new Error('The hero ran out of decisions before the table got there.');
}

function heroActionCount(hand: HandState): number {
  return hand.events.filter((event) => event.type === 'actionTaken' && event.seat === HERO_SEAT)
    .length;
}

/** Every phase the store passed through while `run` was happening. */
function phasesDuring(run: () => void): GamePhase[] {
  const seen: GamePhase[] = [];
  const unsubscribe = useGameStore.subscribe((state) => {
    const phase = state.game?.phase;

    if (phase && phase !== seen[seen.length - 1]) {
      seen.push(phase);
    }
  });

  try {
    run();
  } finally {
    unsubscribe();
  }

  return seen;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  read().leave();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('useGameStore between sessions', () => {
  it('has no game until one is started', () => {
    // The old store dealt a hand at module load, which burnt a session on every
    // reload and handed the lobby a table nobody had asked for.
    expect(read().game).toBeNull();
    expect(read().setup).toEqual(DEFAULT_GAME_SETUP);
  });

  it('ignores everything a screen can do to a table that is not there', () => {
    expect(() => {
      read().act({ type: 'fold' });
      read().setPreselect('callAny');
      read().dismissAdvice();
      read().leave();
    }).not.toThrow();
    expect(read().game).toBeNull();
  });
});

describe('useGameStore dealing', () => {
  it('opens the hand having shown exactly one event', () => {
    read().start(setup(), SEED);

    const game = live();

    expect(game.hand.handNumber).toBe(1);
    expect(game.phase).toBe('dealing');
    // One event per tick, from the very first one: the deal is a sequence the
    // player watches, not a table that appears fully formed.
    expect(game.shown).toBe(1);
    expect(game.hand.events.length).toBeGreaterThan(1);
    expect(game.sessionEnd).toBeNull();
    expect(game.decisionDeadline).toBeNull();
  });

  it('remembers the table that was started', () => {
    const chosen = setup({ opponents: 2, startingStack: 2_500 });

    read().start(chosen, SEED);

    expect(read().setup).toEqual(chosen);
    expect(live().hand.players).toHaveLength(3);
    expect(live().handSeats.every((seat) => seat.stack === 2_500)).toBe(true);
  });

  it('seats one face per player and never the same face twice', () => {
    read().start(setup(), SEED);

    const { avatars } = live();

    expect(avatars).toHaveLength(6);
    expect(new Set(avatars).size).toBe(6);
  });
});

describe('useGameStore pacing the bots', () => {
  it('lets one bot act at a time, with a pause on each', () => {
    const startedAt = Date.now();
    const phases = phasesDuring(() => {
      read().start(setup(), SEED);
      advanceUntil(() => live().phase === 'heroTurn');
    });

    // The hero is on the button, so three seats act before them — three separate
    // thinks, not one burst.
    expect(phases.filter((phase) => phase === 'botThinking')).toHaveLength(3);
    expect(phases[0]).toBe('dealing');
    expect(phases[phases.length - 1]).toBe('heroTurn');
    // Dealing plus three decisions plus showing them: seconds, not microseconds.
    expect(Date.now() - startedAt).toBeGreaterThan(2_000);
  });

  it('reveals an engine burst one event at a time', () => {
    read().start(setup(), SEED);

    const steps: number[] = [];
    let lag = 0;
    let previous = live().shown;
    const unsubscribe = useGameStore.subscribe((state) => {
      const game = state.game;

      if (!game) {
        return;
      }

      lag = Math.max(lag, game.hand.events.length - game.shown);

      if (game.shown > previous) {
        steps.push(game.shown - previous);
      }

      previous = game.shown;
    });

    playUntil(() => live().phase === 'handOver');
    unsubscribe();

    // A street closing or a showdown resolving appends several events at once.
    expect(lag).toBeGreaterThanOrEqual(2);
    // ...and every one of them was shown on its own.
    expect(steps.every((step) => step === 1)).toBe(true);
  });

  it('keeps the pacing stream out of the bots', () => {
    read().start(setup(), SEED);
    advanceUntil(() => live().phase === 'heroTurn');

    // The same table run straight through the engine on the bot stream alone. The
    // logs match only because no think-delay ever drew a number from it — one
    // stolen draw and every decision after it would differ.
    const seats = seatsFor(setup());
    const dealt = startNextHand(startSession(toSessionConfig(setup(), SEED)));
    const played = playUntilSeat(
      dealt.hand,
      HERO_SEAT,
      bySeat(seats.map((seat) => makeBot(seat.profile ?? ROCK))),
      createRng(SEED ^ BOT_SEED_OFFSET),
    );

    expect(live().hand.events).toEqual(played.events);
  });
});

describe('useGameStore preselect', () => {
  it('plays an armed action when the turn arrives, and clears it', () => {
    read().start(setup(), SEED);
    read().setPreselect('callAny');

    expect(live().preselect).toBe('callAny');

    advanceUntil(() => heroActionCount(live().hand) > 0);

    expect(live().preselect).toBeNull();
    expect(live().hand.players[HERO_SEAT]?.committedTotal ?? 0).toBeGreaterThan(0);
  });

  it('drops a check that a bet invalidated rather than folding the hand', () => {
    // Preflop there is always a price, so a `check` armed before the cards are
    // out arrives illegal. Turning it into a fold would throw the hero's hand
    // away for them.
    read().start(setup(), SEED);
    read().setPreselect('check');
    advanceUntil(() => live().phase === 'heroTurn');

    expect(live().preselect).toBeNull();
    expect(live().hand.toAct).toBe(HERO_SEAT);
    expect(live().hand.players[HERO_SEAT]?.status).toBe('active');
    expect(heroActionCount(live().hand)).toBe(0);
  });

  it('folds a check-fold that ran into a bet, because that is what it asked for', () => {
    read().start(setup(), SEED);
    read().setPreselect('checkFold');
    advanceUntil(() => heroActionCount(live().hand) > 0);

    expect(live().hand.players[HERO_SEAT]?.status).toBe('folded');
    expect(live().preselect).toBeNull();
  });

  it('clears on request', () => {
    read().start(setup(), SEED);
    read().setPreselect('callAny');
    read().setPreselect(null);
    advanceUntil(() => live().phase === 'heroTurn');

    expect(live().preselect).toBeNull();
    expect(heroActionCount(live().hand)).toBe(0);
  });
});

describe('useGameStore decision clock', () => {
  it('puts the hero on a clock in real mode, and acts when it runs out', () => {
    read().start(setup({ mode: 'real' }), SEED);
    advanceUntil(() => live().phase === 'heroTurn');

    const deadline = live().decisionDeadline ?? 0;

    // Set from the clock the moment the hero got the action, which the test's own
    // stepping has already moved a few milliseconds past.
    expect(deadline).toBeGreaterThan(Date.now());
    expect(deadline).toBeLessThanOrEqual(Date.now() + DECISION_CLOCK_MS);

    jest.advanceTimersByTime(DECISION_CLOCK_MS);

    // Facing the big blind there is nothing free to take, so it folds.
    expect(live().hand.players[HERO_SEAT]?.status).toBe('folded');
  });

  it('never puts a clock on the hero in learning mode', () => {
    read().start(setup(), SEED);
    advanceUntil(() => live().phase === 'heroTurn');

    const waiting = live().hand;

    expect(live().decisionDeadline).toBeNull();

    jest.advanceTimersByTime(DECISION_CLOCK_MS * 3);

    // Nothing at all is pending: the table waits as long as the player needs.
    expect(live().hand).toBe(waiting);
    expect(live().phase).toBe('heroTurn');
  });

  it('lets the hero beat their own clock, every time', () => {
    read().start(setup({ mode: 'real' }), SEED);

    let taps = 0;

    for (let turn = 0; turn < 8; turn++) {
      advanceUntil(() => live().phase === 'heroTurn' || live().phase === 'handOver');

      if (live().phase !== 'heroTurn') {
        break;
      }

      expect(live().decisionDeadline).not.toBeNull();
      read().act(passive(live().hand));
      taps++;

      // Acting cancels the clock rather than merely resetting it.
      expect(live().decisionDeadline).toBeNull();
    }

    advanceUntil(() => live().phase === 'handOver');

    // One action per tap and not one more: no stale clock ever fired behind the
    // player, which is the race the scheduler's generation exists to lose.
    expect(taps).toBeGreaterThan(0);
    expect(heroActionCount(live().hand)).toBe(taps);
  });
});

describe('useGameStore cancelling', () => {
  it('stops the table dead on leave, with nothing left to fire', () => {
    read().start(setup(), SEED);
    advanceUntil(() => live().phase === 'botThinking');
    read().leave();

    expect(read().game).toBeNull();

    let updates = 0;
    const unsubscribe = useGameStore.subscribe(() => {
      updates++;
    });

    jest.advanceTimersByTime(600_000);
    unsubscribe();

    expect(updates).toBe(0);
    expect(read().game).toBeNull();
  });

  it('cancels the session it replaces rather than letting it act into the new one', () => {
    read().start(setup(), SEED);
    advanceUntil(() => live().phase === 'botThinking');
    read().start(setup(), SEED + 1);
    advanceUntil(() => live().phase === 'heroTurn');

    const afterRestart = live().hand.events;

    read().leave();
    read().start(setup(), SEED + 1);
    advanceUntil(() => live().phase === 'heroTurn');

    // Identical to a clean run of the same seed. A bot left over from the first
    // session would have played an extra action into this log.
    expect(afterRestart).toEqual(live().hand.events);
    expect(live().session.handsPlayed).toBe(0);
  });
});

describe('useGameStore grading', () => {
  it('grades a finished hand exactly as reviewHand does', () => {
    read().start(setup(), SEED);
    playUntil(() => live().advice !== null);

    const game = live();

    expect(game.reviews.length).toBeGreaterThan(0);
    expect(game.reviews).toEqual(
      reviewHand(tableConfigOf(game.hand, game.handSeats), game.hand.events, HERO_SEAT, {
        rng: createRng(game.hand.seed),
        iterations: GRADE_ITERATIONS,
      }),
    );
  });

  it('says nothing about a hand still in progress', () => {
    read().start(setup(), SEED);
    advanceUntil(() => live().phase === 'heroTurn');

    // A verdict mid-hand would leak the ranges the coach modelled.
    expect(live().reviews).toEqual([]);
    expect(live().advice).toBeNull();
  });

  it('books the hand into the coaching history with what it cost', () => {
    read().start(setup(), SEED);
    playUntil(() => live().coachHistory.length === 1);

    const record = live().coachHistory[0];
    const game = live();

    expect(record?.handNumber).toBe(game.hand.handNumber);
    expect(record?.reviews).toEqual(game.reviews);
    expect(record?.net).toBe(
      (game.hand.players[HERO_SEAT]?.stack ?? 0) - (game.handSeats[HERO_SEAT]?.stack ?? 0),
    );
  });

  it('shows the costliest decision in learning mode, and nothing in real mode', () => {
    read().start(setup(), SEED);
    playUntil(() => live().advice !== null);

    const advice = live().advice;

    expect(advice?.total).toBe(live().reviews.length);
    expect(advice?.review?.evLoss).toBe(Math.max(...live().reviews.map((review) => review.evLoss)));

    read().dismissAdvice();

    expect(live().advice).toBeNull();

    read().leave();
    read().start(setup({ mode: 'real' }), SEED);
    playUntil(() => live().coachHistory.length === 1);

    // Real mode is told nothing until the session is over.
    expect(live().advice).toBeNull();
    expect(live().reviews.length).toBeGreaterThan(0);
  });

  it('archives the finished hand, grades and all', async () => {
    const repo = installMemoryHandHistoryRepo();

    read().start(setup(), SEED);
    playUntil(() => live().coachHistory.length === 1);
    await read().archiveIdle();

    const listed = await repo.listHands();

    expect(listed).toHaveLength(1);
    expect(listed[0]?.decisionsGraded).toBe(live().coachHistory[0]?.reviews.length);
    expect(live().saveState).toBe('ok');
  });
});

describe('useGameStore dealing on', () => {
  it('deals the next hand after a beat, without being asked', () => {
    read().start(setup(), SEED);
    playUntil(() => live().phase === 'handOver' && live().advice !== null);

    const finished = live().hand.handNumber;

    advanceUntil(() => live().hand.handNumber === finished + 1);

    const game = live();

    expect(game.session.handsPlayed).toBe(1);
    expect(game.reviews).toEqual([]);
    expect(game.advice).toBeNull();
    // Still being dealt out: the next hand is watched too, not handed over whole.
    expect(game.shown).toBeLessThan(game.hand.events.length);
    expect(game.phase).toBe('dealing');
    expect(game.coachHistory).toHaveLength(1);
  });
});

describe('useGameStore blind levels', () => {
  it('raises the blinds at the next deal in real mode, never inside a hand', () => {
    read().start(setup({ mode: 'real' }), SEED);
    advanceUntil(() => live().phase === 'heroTurn');

    const blinds = live().hand.blinds;

    // The wall clock moves without any timer firing, so a level is due while a
    // hand is in progress. Raising blinds mid-hand would change the price of a
    // bet already made.
    jest.setSystemTime(Date.now() + LEVEL_LENGTH_MS + 1_000);

    expect(live().hand.blinds).toEqual(blinds);
    expect(live().session.level).toBe(0);

    playUntil(() => live().session.handsPlayed === 1);
    advanceUntil(() => live().hand.handNumber === 2);

    expect(live().session.level).toBe(1);
    expect(live().hand.blinds.bigBlind).toBeGreaterThan(blinds.bigBlind);
  });

  it('never escalates in learning mode, however long the session runs', () => {
    read().start(setup(), SEED);
    advanceUntil(() => live().phase === 'heroTurn');

    const blinds = live().hand.blinds;

    jest.setSystemTime(Date.now() + LEVEL_LENGTH_MS * 10);
    playUntil(() => live().session.handsPlayed === 1);
    advanceUntil(() => live().hand.handNumber === 2);

    expect(live().session.levels).toHaveLength(1);
    expect(live().session.level).toBe(0);
    expect(live().hand.blinds).toEqual(blinds);
  });
});

describe('useGameStore ending', () => {
  it('ends the session instead of dealing a hand the engine would refuse', () => {
    // Heads-up for two big blinds each: somebody has everything within a few
    // hands. `startNextHand` throws once the session is over, so reaching this
    // without an exception is half the assertion.
    read().start(setup({ mode: 'real', style: 'sitAndGo', opponents: 1, startingStack: 20 }), SEED);
    playUntil(() => live().phase === 'sessionOver');

    const game = live();
    const end = game.sessionEnd;

    expect(end).not.toBeNull();
    expect(end?.hands).toBe(game.session.handsPlayed);
    expect(end?.hands).toBeGreaterThan(0);
    expect(end?.startedAt).toBe(game.startedAt);
    expect(end?.endedAt).toBeGreaterThanOrEqual(end?.startedAt ?? 0);
    expect(end?.busted).toBe((game.session.seats[HERO_SEAT]?.stack ?? 0) === 0);
    expect(end?.net).toBe(
      game.session.history.reduce((sum, hand) => sum + (hand.results[HERO_SEAT] ?? 0), 0),
    );
  });

  it('stops once it has ended, whatever the clock does next', () => {
    read().start(setup({ mode: 'real', style: 'sitAndGo', opponents: 1, startingStack: 20 }), SEED);
    playUntil(() => live().phase === 'sessionOver');

    const ended = live();

    jest.advanceTimersByTime(600_000);

    expect(live()).toBe(ended);
  });
});
