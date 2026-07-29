import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  installMemoryHandHistoryRepo,
  PersistenceError,
  setHandHistoryRepo,
  type HandHistoryRepo,
} from '@/services/handHistory';

import { useHandHistory } from './useHandHistory';

const SESSION = {
  startedAt: 500,
  style: 'cash',
  seed: 7,
  heroSeat: 0,
  blinds: { smallBlind: 5, bigBlind: 10 },
} as const;

async function seedOneHand(repo: HandHistoryRepo): Promise<void> {
  const sessionId = await repo.createSession(SESSION);

  await repo.saveHand({
    sessionId,
    handNumber: 1,
    playedAt: 1_000,
    seed: 42,
    button: 0,
    blinds: { smallBlind: 5, bigBlind: 10 },
    seats: [{ id: 'You', stack: 1000 }],
    events: [],
    heroNet: 140,
    reviews: [],
  });
}

describe('useHandHistory', () => {
  it('loads the stored hands and totals', async () => {
    const repo = installMemoryHandHistoryRepo();

    await seedOneHand(repo);

    const { result } = await renderHook(() => useHandHistory());

    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    const state = result.current.state;

    expect(state.status === 'ready' && state.hands).toHaveLength(1);
    expect(state.status === 'ready' && state.totals).toEqual({
      hands: 1,
      net: 140,
      decisionsGraded: 0,
    });
  });

  it('lands in the error state when the repository fails', async () => {
    const repo = installMemoryHandHistoryRepo();

    setHandHistoryRepo({
      ...repo,
      listHands: () => Promise.reject(new PersistenceError('read', 'Disk on fire.')),
    });

    const { result } = await renderHook(() => useHandHistory());

    await waitFor(() => expect(result.current.state.status).toBe('error'));
  });

  it('reloads without dropping what is already on screen', async () => {
    const repo = installMemoryHandHistoryRepo();
    const { result } = await renderHook(() => useHandHistory());

    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await seedOneHand(repo);
    await act(async () => result.current.reload());

    // Straight to the fresh list — reload never drops back to 'loading', so
    // the stale rows stay up rather than flashing a spinner.
    const state = result.current.state;

    expect(state.status).toBe('ready');
    expect(state.status === 'ready' && state.hands.length).toBe(1);
  });
});
