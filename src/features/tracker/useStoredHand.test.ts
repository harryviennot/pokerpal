import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import { gradeHand, HERO_SEAT, playHand } from '@/fixtures/playedHand';
import {
  installMemoryHandHistoryRepo,
  PersistenceError,
  setHandHistoryRepo,
  type HandHistoryRepo,
} from '@/services/handHistory';

import { useStoredHand } from './useStoredHand';

const SESSION = {
  startedAt: 500,
  style: 'cash',
  seed: 7,
  heroSeat: HERO_SEAT,
  blinds: { smallBlind: 5, bigBlind: 10 },
} as const;

async function seedHand(repo: HandHistoryRepo): Promise<number> {
  const sessionId = await repo.createSession(SESSION);
  const hand = playHand();

  await repo.saveHand({
    sessionId,
    handNumber: 1,
    playedAt: 1_000,
    seed: 42,
    button: 0,
    blinds: { smallBlind: 5, bigBlind: 10 },
    seats: hand.seats,
    events: hand.events,
    heroNet: -10,
    reviews: gradeHand(hand),
  });

  const listed = await repo.listHands();

  return listed[0]?.id ?? -1;
}

afterEach(async () => {
  await cleanup();
});

describe('useStoredHand', () => {
  it('reads the hand whole, hero seat included', async () => {
    const repo = installMemoryHandHistoryRepo();
    const id = await seedHand(repo);

    const { result } = await renderHook(() => useStoredHand(String(id)));

    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    const { state } = result.current;

    expect(state.status === 'ready' && state.hand.heroSeat).toBe(HERO_SEAT);
    expect(state.status === 'ready' && state.hand.events.length).toBeGreaterThan(0);
    expect(state.status === 'ready' && state.hand.reviews.length).toBe(4);
  });

  it('separates a hand that is gone from a store that is broken', async () => {
    installMemoryHandHistoryRepo();

    const { result } = await renderHook(() => useStoredHand('999'));

    await waitFor(() => expect(result.current.state.status).toBe('notFound'));
  });

  it('never asks the store about an id that is not a number', async () => {
    const repo = installMemoryHandHistoryRepo();
    const getHand = jest.fn(repo.getHand);

    setHandHistoryRepo({ ...repo, getHand });

    const { result } = await renderHook(() => useStoredHand('not-an-id'));

    await waitFor(() => expect(result.current.state.status).toBe('notFound'));
    expect(getHand).not.toHaveBeenCalled();
  });

  it('reports a read failure and recovers on reload', async () => {
    const repo = installMemoryHandHistoryRepo();
    const id = await seedHand(repo);

    let failing = true;

    setHandHistoryRepo({
      ...repo,
      getHand: (handId) =>
        failing
          ? Promise.reject(new PersistenceError('read', 'Disk on fire.'))
          : repo.getHand(handId),
    });

    const { result } = await renderHook(() => useStoredHand(String(id)));

    await waitFor(() => expect(result.current.state.status).toBe('error'));

    failing = false;
    // A bare `act` fires the state update without flushing the fetch it starts.
    await act(async () => result.current.reload());

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
  });
});
