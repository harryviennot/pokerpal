import { cleanup, render, screen, userEvent } from '@testing-library/react-native';

import { TableScreen } from './TableScreen';

const setupUser = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

/** Steps the replay forwards by pressing the primary control. */
async function stepForward(user: ReturnType<typeof userEvent.setup>, times: number) {
  for (let step = 0; step < times; step++) {
    await user.press(screen.getByLabelText('Next action'));
  }
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(async () => {
  await cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('TableScreen', () => {
  it('opens on the first frame of the demo hand', async () => {
    await render(<TableScreen />);

    expect(screen.getByText('Hand #1 begins, button on You')).toBeOnTheScreen();
    expect(screen.getByText(/^Preflop · 1 of/)).toBeOnTheScreen();
  });

  it('seats every player with their starting stack', async () => {
    await render(<TableScreen />);

    expect(screen.getByLabelText('You, 1 000 behind')).toBeOnTheScreen();
    expect(screen.getByLabelText('Ben, 240 behind')).toBeOnTheScreen();
    expect(screen.getByLabelText('Dealer button')).toBeOnTheScreen();
  });

  it('advances the commentary one action at a time', async () => {
    const user = setupUser();

    await render(<TableScreen />);
    await stepForward(user, 1);

    expect(screen.getByText('Ava posts the small blind 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bet 5')).toBeOnTheScreen();
  });

  it('will not step back past the start of the hand', async () => {
    const user = setupUser();

    await render(<TableScreen />);
    await user.press(screen.getByLabelText('Previous action'));

    expect(screen.getByText('Hand #1 begins, button on You')).toBeOnTheScreen();
  });

  it('keeps the opponents face down while the hero is face up', async () => {
    const user = setupUser();

    await render(<TableScreen />);
    // Blinds, then two cards to each of the six seats.
    await stepForward(user, 8);

    expect(screen.getAllByLabelText('Face-down card')).toHaveLength(10);
    expect(screen.getByLabelText('A of clubs')).toBeOnTheScreen();
    expect(screen.getByLabelText('A of diamonds')).toBeOnTheScreen();
  });

  it('deals the board and pulls the bets into the pot on the flop', async () => {
    const user = setupUser();

    await render(<TableScreen />);
    await user.press(screen.getByLabelText('Next street'));

    expect(screen.getByText(/^Flop ·/)).toBeOnTheScreen();
    // Two callers of a raise to 30, plus the small blind that folded.
    expect(screen.getByLabelText('POT 95')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Bet 30')).not.toBeOnTheScreen();
  });

  it('shows the hand down and pays the winner', async () => {
    const user = setupUser();

    await render(<TableScreen />);
    for (let street = 0; street < 5; street++) {
      await user.press(screen.getByLabelText('Next street'));
    }

    expect(screen.getByText(/^Hand ends on the/)).toBeOnTheScreen();
    expect(screen.getByLabelText('You, 1 320 behind')).toBeOnTheScreen();
    expect(screen.getByLabelText('Ben, 0 behind')).toBeOnTheScreen();
  });
});
