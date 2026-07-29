import { cleanup, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { gradeHand, HERO_SEAT, playHand } from '@/fixtures/playedHand';
import {
  installMemoryHandHistoryRepo,
  PersistenceError,
  setHandHistoryRepo,
  type HandHistoryRepo,
  type NewHandRecord,
} from '@/services/handHistory';

import { HandReplayScreen } from './HandReplayScreen';

// The screen sets its own title; under Jest there is no navigator to set it on.
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));

const SESSION = {
  startedAt: 500,
  style: 'cash',
  seed: 7,
  heroSeat: HERO_SEAT,
  blinds: { smallBlind: 5, bigBlind: 10 },
} as const;

async function seedHand(
  repo: HandHistoryRepo,
  overrides: Partial<NewHandRecord> = {},
): Promise<number> {
  const sessionId = await repo.createSession(SESSION);
  const hand = playHand();

  await repo.saveHand({
    sessionId,
    handNumber: 12,
    playedAt: 1_000,
    seed: 42,
    button: 0,
    blinds: { smallBlind: 5, bigBlind: 10 },
    seats: hand.seats,
    events: hand.events,
    heroNet: -10,
    reviews: gradeHand(hand),
    ...overrides,
  });

  const listed = await repo.listHands();

  return listed[0]?.id ?? -1;
}

afterEach(async () => {
  await cleanup();
});

describe('HandReplayScreen', () => {
  it('opens the stored hand on its first frame, with the hero on the felt', async () => {
    const repo = installMemoryHandHistoryRepo();
    const id = await seedHand(repo);

    await render(<HandReplayScreen handId={String(id)} />);

    await waitFor(() => expect(screen.getByText(/Hand #1 begins/)).toBeOnTheScreen());

    expect(screen.getByText('Preflop · 1 of 26')).toBeOnTheScreen();
    expect(screen.getByLabelText('You, 1 000 behind')).toBeOnTheScreen();
    expect(screen.getByText('HAND')).toBeOnTheScreen();
    expect(screen.getByText('Decisions graded')).toBeOnTheScreen();
  });

  it('steps through the log and jumps street to street', async () => {
    const repo = installMemoryHandHistoryRepo();
    const id = await seedHand(repo);
    const user = userEvent.setup();

    await render(<HandReplayScreen handId={String(id)} />);

    await waitFor(() => expect(screen.getByText('Preflop · 1 of 26')).toBeOnTheScreen());

    await user.press(screen.getByLabelText('Next action'));
    expect(screen.getByText('Preflop · 2 of 26')).toBeOnTheScreen();

    await user.press(screen.getByLabelText('Next street'));
    expect(screen.getByText(/^Flop · /)).toBeOnTheScreen();

    await user.press(screen.getByLabelText('Restart the hand'));
    expect(screen.getByText('Preflop · 1 of 26')).toBeOnTheScreen();
  });

  it("shows the coach's verdict on the frame of the decision it graded", async () => {
    const repo = installMemoryHandHistoryRepo();
    const id = await seedHand(repo);
    const user = userEvent.setup();

    await render(<HandReplayScreen handId={String(id)} />);

    await waitFor(() => expect(screen.getByText('Preflop · 1 of 26')).toBeOnTheScreen());

    // The list below the felt always carries every verdict; the felt carries one
    // only while the cursor is on the action it belongs to.
    const preflop = /^Preflop: Correct\. Called/;

    expect(screen.getAllByLabelText(preflop)).toHaveLength(1);

    // Deal, three hole cards, two blinds, then the hero is first to act.
    for (let step = 0; step < 6; step++) {
      await user.press(screen.getByLabelText('Next action'));
    }

    expect(screen.getByText('You calls 10')).toBeOnTheScreen();
    expect(screen.getAllByLabelText(preflop)).toHaveLength(2);
  });

  it('says so when the hand had nothing to grade', async () => {
    const repo = installMemoryHandHistoryRepo();
    const id = await seedHand(repo, { reviews: [] });

    await render(<HandReplayScreen handId={String(id)} />);

    await waitFor(() =>
      expect(
        screen.getByText('The hand ended before you had a decision to make.'),
      ).toBeOnTheScreen(),
    );
  });

  it('says the hand is gone rather than blaming the database', async () => {
    installMemoryHandHistoryRepo();

    await render(<HandReplayScreen handId="404" />);

    await waitFor(() => expect(screen.getByText('Hand not found')).toBeOnTheScreen());
    expect(screen.queryByLabelText('Try again')).not.toBeOnTheScreen();
  });

  it('offers a retry when the read fails, and the retry works', async () => {
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

    const user = userEvent.setup();

    await render(<HandReplayScreen handId={String(id)} />);

    await waitFor(() => expect(screen.getByText('Hand is unavailable')).toBeOnTheScreen());

    failing = false;
    await user.press(screen.getByLabelText('Try again'));

    await waitFor(() => expect(screen.getByText('Preflop · 1 of 26')).toBeOnTheScreen());
  });
});
