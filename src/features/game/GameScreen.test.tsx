import { act, cleanup, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { legalActions, type Action, type HandState } from '@/engine';

import { GameScreen } from './GameScreen';
import { LEVEL_LENGTH_MS } from './pacing';
import { DEFAULT_GAME_SETUP, type GameSetup } from './tableSetup';
import { type ActiveGame, type GamePhase } from './types';
import { HERO_SEAT, useGameStore } from './useGameStore';

jest.mock('expo-router', () => ({
  // A stand-in that says where it went, so a redirect is something to assert on.
  Redirect: ({ href }: { href: string }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').createElement(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('react-native').Text,
      null,
      `Redirected to ${href}`,
    ),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

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

/** A small table: fewer bots means fewer thinks to sit through in a test. */
function setup(overrides: Partial<GameSetup> = {}): GameSetup {
  return { ...DEFAULT_GAME_SETUP, opponents: 2, ...overrides };
}

const setupUser = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

/**
 * Turns the clock in small steps until the table gets where it is going.
 *
 * Inside `act` because the store drives the screen from a timer: the pump
 * schedules the next step from inside the last one, so this has to turn the clock
 * rather than skip it, and every turn lands a React update.
 */
async function advanceUntil(reached: () => boolean, budgetMs = 60_000): Promise<void> {
  const stepMs = 100;

  for (let elapsed = 0; elapsed < budgetMs && !reached(); elapsed += stepMs) {
    await act(async () => {
      jest.advanceTimersByTime(stepMs);
    });
  }

  if (!reached()) {
    throw new Error(`The table never got there; it is ${live().phase}.`);
  }
}

const atPhase = (phase: GamePhase) => (): boolean => live().phase === phase;

/** The hero as a calling station: never folds while there is a cheaper option. */
function passive(hand: HandState): Action {
  const legal = legalActions(hand);

  if (legal.some((action) => action.type === 'check')) {
    return { type: 'check' };
  }

  return legal.some((action) => action.type === 'call') ? { type: 'call' } : { type: 'fold' };
}

/** Plays the hero passively, a decision at a time, until `reached`. */
async function playUntil(reached: () => boolean): Promise<void> {
  for (let decision = 0; decision < 60 && !reached(); decision++) {
    await advanceUntil(() => reached() || live().phase === 'heroTurn');

    if (reached()) {
      return;
    }

    await act(async () => {
      read().act(passive(live().hand));
    });
  }

  if (!reached()) {
    throw new Error('The hero ran out of decisions before the table got there.');
  }
}

/** Replaces part of the live game, for the states a test should not have to play. */
async function patch(change: Partial<ActiveGame>): Promise<void> {
  await act(async () => {
    useGameStore.setState({ game: { ...live(), ...change } });
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  read().leave();
});

afterEach(async () => {
  await cleanup();
  read().leave();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('GameScreen with no game', () => {
  it('sends a cold deep link back to the lobby instead of crashing', async () => {
    await render(<GameScreen />);

    expect(screen.getByText('Redirected to /lobby')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Leave the table')).not.toBeOnTheScreen();
  });
});

describe('GameScreen playing a hand', () => {
  it('seats the table and puts the hero on the clock', async () => {
    read().start(setup(), SEED);

    await render(<GameScreen />);
    await advanceUntil(atPhase('heroTurn'));

    expect(screen.getByLabelText('Dealer button')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^You, /)).toBeOnTheScreen();
    expect(screen.getByLabelText('Fold')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Call /)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Raise \d/)).toBeOnTheScreen();
  });

  it('shows the session clock and the way into the review', async () => {
    read().start(setup(), SEED);

    await render(<GameScreen />);

    expect(screen.getByText(/^\d+:\d\d$/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Review this session')).toBeOnTheScreen();
  });

  it('leaves the bottom of the screen to the table, with no replay chrome on it', async () => {
    read().start(setup(), SEED);

    await render(<GameScreen />);
    await advanceUntil(atPhase('heroTurn'));

    // The old screen stacked a commentary line, replay controls and a result row
    // under the felt. Live play has none of it: a hand in progress is not a replay.
    expect(screen.queryByLabelText('Restart the hand')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Next hand')).not.toBeOnTheScreen();
    expect(screen.queryByText(/of \d+$/)).not.toBeOnTheScreen();
  });

  it('plays the hero decision through the store', async () => {
    const user = setupUser();

    read().start(setup(), SEED);

    await render(<GameScreen />);
    await advanceUntil(atPhase('heroTurn'));

    const before = live().hand.events.length;

    await user.press(screen.getByLabelText(/^Call /));

    expect(live().hand.events.length).toBeGreaterThan(before);
    expect(live().hand.toAct).not.toBe(HERO_SEAT);
  });

  it('arms an action while somebody else is thinking', async () => {
    const user = setupUser();

    read().start(setup(), SEED);

    await render(<GameScreen />);
    // The hero is on the button at a three-handed table, so they act first and
    // nobody has thought yet: acting is what hands the clock to a bot.
    await advanceUntil(atPhase('heroTurn'));
    await user.press(screen.getByLabelText(/^Call /));
    await advanceUntil(atPhase('botThinking'));
    await user.press(screen.getByLabelText(/^(Check\/Fold|Fold)$/));

    expect(live().preselect).toBe('checkFold');
  });
});

describe('GameScreen coaching', () => {
  it('brings the coach in as a notice once a hand is graded, and lets it be dismissed', async () => {
    const user = setupUser();

    read().start(setup(), SEED);

    await render(<GameScreen />);
    await playUntil(() => live().advice?.review != null);

    const reason = live().advice?.review?.reason ?? '';

    expect(screen.getByText(reason)).toBeOnTheScreen();

    await user.press(screen.getByLabelText('Dismiss the coach'));

    expect(live().advice).toBeNull();
    expect(screen.queryByText(reason)).not.toBeOnTheScreen();
  });

  it('says nothing mid-session in real mode', async () => {
    read().start(setup({ mode: 'real' }), SEED);

    await render(<GameScreen />);
    await playUntil(() => live().coachHistory.length === 1);

    expect(live().advice).toBeNull();
    expect(screen.queryByLabelText('Dismiss the coach')).not.toBeOnTheScreen();
  });

  it('prices the hero hand against the pot while it plays, in learning mode', async () => {
    read().start(setup(), SEED);

    await render(<GameScreen />);
    await advanceUntil(atPhase('heroTurn'));

    // Against unknown hands, so it is the number a player could work out for
    // themselves rather than a peek at what the bots are holding.
    expect(screen.getByText(/^\d+% to win · \d+% to call$/)).toBeOnTheScreen();
    // ...and the same figure printed on the hero's own cards.
    expect(screen.getByText(/^\d+%$/)).toBeOnTheScreen();
  });

  it('withholds the live read in real mode, where coaching waits for the summary', async () => {
    read().start(setup({ mode: 'real' }), SEED);

    await render(<GameScreen />);
    await advanceUntil(atPhase('heroTurn'));

    expect(screen.queryByText(/to win/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/^\d+%$/)).not.toBeOnTheScreen();
  });
});

describe('GameScreen in real mode', () => {
  it('counts down to the blinds that are coming', async () => {
    read().start(setup({ mode: 'real' }), SEED);

    await render(<GameScreen />);

    const next = live().session.levels[1];

    expect(next).toBeDefined();
    expect(screen.getByText(`${next?.smallBlind} - ${next?.bigBlind}`)).toBeOnTheScreen();
    expect(screen.getByText(/^in \d+:\d\d$/)).toBeOnTheScreen();
  });

  it('shows what is left of the hero clock, and only while they are on it', async () => {
    read().start(setup({ mode: 'real' }), SEED);

    await render(<GameScreen />);
    await advanceUntil(atPhase('heroTurn'));

    expect(screen.getByLabelText(/^\d+ seconds to act$/)).toBeOnTheScreen();

    await patch({ phase: 'botThinking', decisionDeadline: null });

    expect(screen.queryByLabelText(/seconds to act$/)).not.toBeOnTheScreen();
  });

  it('never puts a clock on a learning session', async () => {
    read().start(setup(), SEED);

    await render(<GameScreen />);
    await advanceUntil(atPhase('heroTurn'));

    expect(screen.queryByLabelText(/seconds to act$/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/^in \d+:\d\d$/)).not.toBeOnTheScreen();
  });

  it('shows the blinds that come after the level the clock has reached', async () => {
    read().start(setup({ mode: 'real' }), SEED);

    await render(<GameScreen />);

    const later = live().session.levels[2];

    await act(async () => {
      jest.setSystemTime(Date.now() + LEVEL_LENGTH_MS + 1_000);
      jest.advanceTimersByTime(1_000);
    });

    expect(screen.getByText(`${later?.smallBlind} - ${later?.bigBlind}`)).toBeOnTheScreen();
  });
});

describe('GameScreen when the session ends', () => {
  it('hands a real session over to the summary', async () => {
    read().start(setup({ mode: 'real' }), SEED);

    await render(<GameScreen />);

    await patch({
      phase: 'sessionOver',
      sessionEnd: {
        hands: 3,
        net: -120,
        startedAt: live().startedAt,
        endedAt: live().startedAt + 1_000,
        busted: false,
      },
    });

    expect(router.replace).toHaveBeenCalledWith('/game/summary');
    // The summary reads the finished game, so the table must not clear it away.
    expect(read().game).not.toBeNull();
  });

  it('returns a learning session to the lobby, which has been coaching all along', async () => {
    read().start(setup(), SEED);

    await render(<GameScreen />);

    await patch({
      phase: 'sessionOver',
      sessionEnd: {
        hands: 3,
        net: 40,
        startedAt: live().startedAt,
        endedAt: live().startedAt + 1_000,
        busted: false,
      },
    });

    expect(read().game).toBeNull();
    expect(screen.getByText('Redirected to /lobby')).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('leaves the table on request, and stops the session dead', async () => {
    const user = setupUser();

    read().start(setup(), SEED);

    await render(<GameScreen />);
    await user.press(screen.getByLabelText('Leave the table'));

    expect(read().game).toBeNull();
    expect(screen.getByText('Redirected to /lobby')).toBeOnTheScreen();
  });
});
