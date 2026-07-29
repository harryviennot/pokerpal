import { cleanup, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import {
  installMemoryHandHistoryRepo,
  PersistenceError,
  setHandHistoryRepo,
  type HandHistoryRepo,
} from '@/services/handHistory';

import { HistoryScreen } from './HistoryScreen';

// The focus effect needs a navigator; under Jest "focused once" is an effect.
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react') as { useEffect: (run: () => void, deps: unknown[]) => void };

  return {
    router: { push: jest.fn() },
    useFocusEffect: (callback: () => void) => {
      react.useEffect(callback, [callback]);
    },
  };
});

const SESSION = {
  startedAt: 500,
  style: 'cash',
  seed: 7,
  heroSeat: 0,
  blinds: { smallBlind: 5, bigBlind: 10 },
} as const;

async function seedHands(repo: HandHistoryRepo): Promise<void> {
  const sessionId = await repo.createSession(SESSION);
  const base = {
    sessionId,
    seed: 42,
    button: 0,
    blinds: { smallBlind: 5, bigBlind: 10 },
    seats: [{ id: 'You', stack: 1000 }],
    events: [],
  } as const;

  await repo.saveHand({ ...base, handNumber: 1, playedAt: 1_000, heroNet: 140, reviews: [] });
  await repo.saveHand({ ...base, handNumber: 2, playedAt: 2_000, heroNet: -60, reviews: [] });
}

afterEach(async () => {
  await cleanup();
});

describe('HistoryScreen', () => {
  it('lists the stored hands, newest first, under the all-time ledger', async () => {
    const repo = installMemoryHandHistoryRepo();

    await seedHands(repo);
    await render(<HistoryScreen />);

    await waitFor(() => expect(screen.getByText('ALL TIME')).toBeOnTheScreen());

    expect(screen.getByText('Hands played')).toBeOnTheScreen();
    expect(screen.getByText('+80')).toBeOnTheScreen();
    expect(screen.getByText('Hand #2')).toBeOnTheScreen();
    expect(screen.getByText('Hand #1')).toBeOnTheScreen();
    expect(screen.getByText('+140')).toBeOnTheScreen();
    expect(screen.getByText('-60')).toBeOnTheScreen();
  });

  it('opens the hand a row is tapped on', async () => {
    const repo = installMemoryHandHistoryRepo();

    await seedHands(repo);

    const user = userEvent.setup();

    await render(<HistoryScreen />);

    await waitFor(() => expect(screen.getByText('Hand #2')).toBeOnTheScreen());

    // Newest first, so the second stored hand is the first row.
    await user.press(screen.getByLabelText('Hand 2, lost 60 chips'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/history/[id]',
      params: { id: '2' },
    });
  });

  it('says so when nothing has been played', async () => {
    installMemoryHandHistoryRepo();

    await render(<HistoryScreen />);

    await waitFor(() => expect(screen.getByText('No hands yet')).toBeOnTheScreen());
    expect(screen.queryByText('ALL TIME')).not.toBeOnTheScreen();
  });

  it('offers a retry when reading fails, and the retry works', async () => {
    const repo = installMemoryHandHistoryRepo();

    await seedHands(repo);

    let failing = true;

    setHandHistoryRepo({
      ...repo,
      listHands: (options) =>
        failing
          ? Promise.reject(new PersistenceError('read', 'Disk on fire.'))
          : repo.listHands(options),
    });

    const user = userEvent.setup();

    await render(<HistoryScreen />);

    await waitFor(() => expect(screen.getByText('History is unavailable')).toBeOnTheScreen());

    failing = false;
    await user.press(screen.getByLabelText('Try again'));

    await waitFor(() => expect(screen.getByText('Hand #2')).toBeOnTheScreen());
  });
});
