import { cleanup, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { type DecisionFacts, type DecisionReview } from '@/engine';
import {
  getHandHistoryRepo,
  installMemoryHandHistoryRepo,
  PersistenceError,
  type HandHistoryRepo,
  type StoredHandSummary,
} from '@/services/handHistory';

import { SessionSummaryScreen } from './SessionSummaryScreen';
import { DEFAULT_GAME_SETUP } from './tableSetup';
import { type HandCoachRecord, type SessionSummaryData } from './types';
import { useGameStore } from './useGameStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), dismissTo: jest.fn(), replace: jest.fn() },
}));

const read = () => useGameStore.getState();

const SEED = 20260728;

const FACTS: DecisionFacts = {
  street: 'flop',
  playersBehind: 0,
  pot: 100,
  toCall: 25,
  stack: 900,
  spr: 9,
  equity: 0.18,
  requiredEquity: 0.2,
  outs: 0,
};

function review(overrides: Partial<DecisionReview> = {}): DecisionReview {
  return {
    seat: 0,
    action: { type: 'call' },
    best: { type: 'fold' },
    grade: 'correct',
    evLoss: 0,
    reason: 'Called 25% of pot holding 18% equity, needing 20%.',
    leak: null,
    facts: FACTS,
    ...overrides,
  };
}

let repo: HandHistoryRepo;

/**
 * Plays a real session with fake timers until `hands` of them are on the books,
 * then waits for the disk. The hero folds everything, which is the fastest legal
 * way to book hands the archiver has actually written.
 */
async function playHands(hands: number): Promise<readonly StoredHandSummary[]> {
  read().start(DEFAULT_GAME_SETUP, SEED);

  for (let step = 0; step < 1_000 && booked() < hands; step++) {
    jest.advanceTimersByTime(200);

    if (read().game?.phase === 'heroTurn') {
      read().act({ type: 'fold' });
    }
  }

  expect(booked()).toBeGreaterThanOrEqual(hands);

  await read().archiveIdle();

  const sessionId = await read().storedSessionId();

  expect(sessionId).not.toBeNull();

  return repo.listSessionHands(sessionId ?? 0);
}

function booked(): number {
  return read().game?.coachHistory.length ?? 0;
}

/**
 * Ends the session on the store the way the pump does, with the records the
 * assertions need. Real timers from here on: the session is over, and a pending
 * pump timer firing under a `waitFor` would deal into it.
 */
function endSession(records: HandCoachRecord[], overrides: Partial<SessionSummaryData> = {}): void {
  const game = read().game;

  if (!game) {
    throw new Error('There is no game.');
  }

  useGameStore.setState({
    game: {
      ...game,
      phase: 'sessionOver',
      coachHistory: records,
      sessionEnd: {
        hands: records.length,
        net: records.reduce((sum, record) => sum + record.net, 0),
        startedAt: 0,
        endedAt: 43 * 60_000,
        busted: false,
        ...overrides,
      },
    },
  });
  jest.useRealTimers();
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  read().leave();
  repo = installMemoryHandHistoryRepo();
});

afterEach(async () => {
  await cleanup();
  read().leave();
  jest.useRealTimers();
});

describe('SessionSummaryScreen without a session', () => {
  it('says so rather than rendering an empty report', async () => {
    const user = userEvent.setup();

    jest.useRealTimers();

    await render(<SessionSummaryScreen />);

    expect(screen.getByText('No session to report')).toBeOnTheScreen();

    await user.press(screen.getByLabelText('Back to the lobby'));

    expect(router.dismissTo).toHaveBeenCalledWith('/lobby');
  });

  it('says so for a game that is still being played', async () => {
    read().start(DEFAULT_GAME_SETUP, SEED);
    jest.useRealTimers();

    await render(<SessionSummaryScreen />);

    expect(screen.getByText('No session to report')).toBeOnTheScreen();
  });
});

describe('SessionSummaryScreen', () => {
  it('says how the session went, in chips, hands and minutes', async () => {
    await playHands(1);
    endSession([
      { handNumber: 1, net: 340, reviews: [review()] },
      { handNumber: 2, net: -100, reviews: [review()] },
    ]);

    await render(<SessionSummaryScreen />);

    // The session's net, its two hands, and how long it ran.
    expect(screen.getByText('+240')).toBeOnTheScreen();
    expect(screen.getByText('You walked away up.')).toBeOnTheScreen();
    expect(screen.getByText('2 hands · 43 min')).toBeOnTheScreen();
    expect(screen.getByText('+340')).toBeOnTheScreen();
    expect(screen.getByText('-100')).toBeOnTheScreen();
  });

  it('says plainly when the stack is gone', async () => {
    await playHands(1);
    endSession(
      [
        { handNumber: 1, net: -400, reviews: [review()] },
        { handNumber: 2, net: -600, reviews: [review()] },
      ],
      { busted: true },
    );

    await render(<SessionSummaryScreen />);

    expect(screen.getByText('You lost your stack.')).toBeOnTheScreen();
    expect(screen.getByText('-1 000')).toBeOnTheScreen();
  });

  it('breaks the decisions down by verdict and names the top leak', async () => {
    await playHands(1);
    endSession([
      {
        handNumber: 1,
        net: -120,
        reviews: [
          review(),
          review({ grade: 'marginal', evLoss: 6 }),
          review({ grade: 'blunder', evLoss: 90, leak: 'overBluffing' }),
        ],
      },
    ]);

    await render(<SessionSummaryScreen />);

    expect(screen.getByText('Well played')).toBeOnTheScreen();
    expect(screen.getByText('Costly mistake')).toBeOnTheScreen();
    expect(screen.getByText('3 decisions graded.')).toBeOnTheScreen();
    expect(screen.getByText('Bluffing too often ×1')).toBeOnTheScreen();
    expect(screen.getByText(/Focus: Bluff less often/)).toBeOnTheScreen();
  });

  it('replays the best and the worst hand, explaining why each is which', async () => {
    const user = userEvent.setup();
    const stored = await playHands(2);
    const [first, second] = stored;

    endSession([
      {
        handNumber: 1,
        net: 260,
        reviews: [
          review({
            facts: { ...FACTS, pot: 900 },
            reason: 'Called 10% of pot holding 34% equity, needing 9%.',
          }),
        ],
      },
      {
        handNumber: 2,
        net: -180,
        reviews: [
          review({
            grade: 'blunder',
            evLoss: 140,
            leak: 'chasingWithoutOdds',
            reason: 'Called 60% of pot with 12% equity, needing 37%.',
          }),
        ],
      },
    ]);

    await render(<SessionSummaryScreen />);

    expect(await screen.findByText('BEST DECISION · HAND #1')).toBeOnTheScreen();
    expect(screen.getByText('COSTLIEST DECISION · HAND #2')).toBeOnTheScreen();
    // Both hands are explained, each against the pot it was actually played for.
    expect(screen.getByText(/You paid 25 to stay in, for a pot of 900\./)).toBeOnTheScreen();
    expect(screen.getByText(/You paid 25 to stay in, for a pot of 100\./)).toBeOnTheScreen();

    await user.press(screen.getByLabelText('Costliest decision, hand 2'));

    expect(second?.handNumber).toBe(2);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/game/hand/[id]',
      params: { id: String(second?.id) },
    });

    await user.press(screen.getByLabelText('Best decision, hand 1'));

    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/game/hand/[id]',
      params: { id: String(first?.id) },
    });
  });

  it('still shows the verdicts when no hand reached the disk', async () => {
    const user = userEvent.setup();

    // A session whose every write failed: the coach graded it, storage lost it.
    read().start(DEFAULT_GAME_SETUP, SEED);
    endSession([
      { handNumber: 1, net: 40, reviews: [review()] },
      { handNumber: 2, net: -90, reviews: [review({ grade: 'mistake', evLoss: 60 })] },
    ]);

    await render(<SessionSummaryScreen />);

    expect(await screen.findByText(/This session was not saved/)).toBeOnTheScreen();
    expect(screen.getByText('BEST DECISION · HAND #1')).toBeOnTheScreen();
    expect(screen.getAllByText(/cannot be replayed/).length).toBeGreaterThan(0);

    await user.press(screen.getByLabelText('Best decision, hand 1'));

    expect(router.push).not.toHaveBeenCalled();
  });

  it('offers a retry when the saved hands cannot be read', async () => {
    const user = userEvent.setup();

    await playHands(1);
    endSession([{ handNumber: 1, net: 40, reviews: [review()] }]);

    const listSessionHands = jest
      .spyOn(repo, 'listSessionHands')
      .mockRejectedValue(new PersistenceError('read', 'no disk'));

    await render(<SessionSummaryScreen />);

    expect(await screen.findByText(/could not be read/)).toBeOnTheScreen();

    listSessionHands.mockRestore();
    await user.press(screen.getByLabelText('Try again'));

    expect(await screen.findByText('Replay this hand ›')).toBeOnTheScreen();
  });

  it('leaves the session behind on the way out', async () => {
    const user = userEvent.setup();

    await playHands(1);
    endSession([{ handNumber: 1, net: 40, reviews: [review()] }]);

    await render(<SessionSummaryScreen />);
    await user.press(screen.getByLabelText('Play again'));

    expect(read().game).toBeNull();
    expect(router.dismissTo).toHaveBeenCalledWith('/lobby');
  });

  it('sends a player who is finished to their hand history', async () => {
    const user = userEvent.setup();

    await playHands(1);
    endSession([{ handNumber: 1, net: 40, reviews: [review()] }]);

    await render(<SessionSummaryScreen />);
    await user.press(screen.getByLabelText('Done'));

    expect(read().game).toBeNull();
    expect(router.dismissTo).toHaveBeenCalledWith('/history');
  });

  it('warns when some of the session never saved', async () => {
    await playHands(1);
    endSession([{ handNumber: 1, net: 40, reviews: [review()] }]);

    const game = read().game;

    if (game) {
      useGameStore.setState({ game: { ...game, saveState: 'error' } });
    }

    await render(<SessionSummaryScreen />);

    expect(screen.getByText(/won't appear in History/)).toBeOnTheScreen();
  });
});

/** The repository the hook reaches for is the one the test installed. */
it('reads the same repository the archiver wrote to', async () => {
  expect(await getHandHistoryRepo()).toBe(repo);
});
