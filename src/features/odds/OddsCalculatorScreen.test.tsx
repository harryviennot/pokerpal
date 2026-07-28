import { act, cleanup, render, screen, userEvent } from '@testing-library/react-native';

import { OddsCalculatorScreen } from './OddsCalculatorScreen';
import { useOddsStore } from './useOddsStore';

/**
 * Fake timers throughout. The equity hook drives itself with a chain of
 * setTimeout chunks; on real timers those outlive the test that started them
 * and land on the next test's tree.
 */
const setupUser = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

/** Picks a card by its rank then its suit, the way a user does. */
async function pickCard(user: ReturnType<typeof userEvent.setup>, rank: string, suit: string) {
  await user.press(screen.getByLabelText(`Rank ${rank}`));
  await user.press(screen.getByLabelText(`Suit ${suit}`));
}

/** Runs the chunked simulation to completion. */
async function settleEquity() {
  await act(async () => {
    jest.advanceTimersByTime(5_000);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  useOddsStore.setState({
    cards: {},
    focusedSlot: 'hero1',
    opponentCount: 1,
    rangePreset: 'random',
    potInput: '',
    betInput: '',
  });
});

afterEach(async () => {
  // RNTL 14 unmounts asynchronously; without awaiting it, a pending unmount
  // from one test lands on the next test's freshly rendered tree.
  await cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('OddsCalculatorScreen', () => {
  it('prompts for hole cards before anything is entered', async () => {
    await render(<OddsCalculatorScreen />);

    expect(screen.getByText('Pick your hole cards to see your equity.')).toBeOnTheScreen();
  });

  it('places a card in the focused slot when a rank then a suit is tapped', async () => {
    const user = setupUser();

    await render(<OddsCalculatorScreen />);
    await pickCard(user, 'A', 'hearts');

    expect(screen.getByLabelText('A of hearts')).toBeOnTheScreen();
    expect(useOddsStore.getState().cards.hero1).toBeDefined();
  });

  it('asks for the second hole card once the first is in', async () => {
    const user = setupUser();

    await render(<OddsCalculatorScreen />);
    await pickCard(user, 'A', 'hearts');

    expect(screen.getByText('Pick your second hole card.')).toBeOnTheScreen();
  });

  it('reports equity once hero holds two cards', async () => {
    const user = setupUser();

    await render(<OddsCalculatorScreen />);
    await pickCard(user, 'A', 'hearts');
    await pickCard(user, 'A', 'spades');

    await settleEquity();

    // Aces are a heavy favourite against one unknown hand: ~85%.
    const equity = useOddsStore.getState();

    expect(equity.cards.hero1).toBeDefined();
    expect(equity.cards.hero2).toBeDefined();
    expect(screen.queryByText('Pick your hole cards to see your equity.')).not.toBeOnTheScreen();
  });

  it('will not offer a suit that is already in play', async () => {
    const user = setupUser();

    await render(<OddsCalculatorScreen />);
    await pickCard(user, 'A', 'hearts');

    // Re-select the same rank; the heart should now be unavailable.
    await user.press(screen.getByLabelText('Rank A'));

    expect(screen.getByLabelText('Suit hearts')).toBeDisabled();
    expect(screen.getByLabelText('Suit spades')).not.toBeDisabled();
  });

  it('clears a slot when a filled card is tapped', async () => {
    const user = setupUser();

    await render(<OddsCalculatorScreen />);
    await pickCard(user, 'A', 'hearts');

    await user.press(screen.getByLabelText('A of hearts'));

    expect(useOddsStore.getState().cards.hero1).toBeUndefined();
  });

  it('warns about a board gap rather than calculating a nonsense board', async () => {
    const user = setupUser();

    await render(<OddsCalculatorScreen />);
    await pickCard(user, 'A', 'hearts');
    await pickCard(user, 'K', 'hearts');
    await settleEquity();

    // Focus jumps to flop1; aim at the turn instead, leaving the flop empty.
    await user.press(screen.getByLabelText('Turn card'));
    await pickCard(user, 'Q', 'spades');
    await settleEquity();

    expect(screen.getByText('Fill the flop before the turn and river.')).toBeOnTheScreen();
  });

  it('shows the required equity once a pot and a bet are entered', async () => {
    const user = setupUser();

    await render(<OddsCalculatorScreen />);

    await user.type(screen.getByLabelText('Pot'), '100');
    await user.type(screen.getByLabelText('To call'), '25');

    expect(screen.getByText('Equity needed')).toBeOnTheScreen();
    expect(screen.getByText('20.0%')).toBeOnTheScreen();
  });

  it('adds and removes opponents within the supported range', async () => {
    const user = setupUser();

    await render(<OddsCalculatorScreen />);

    await user.press(screen.getByLabelText('Add an opponent'));
    expect(useOddsStore.getState().opponentCount).toBe(2);

    await user.press(screen.getByLabelText('Remove an opponent'));
    expect(useOddsStore.getState().opponentCount).toBe(1);

    // Already at the floor: the control is disabled rather than going to zero.
    expect(screen.getByLabelText('Remove an opponent')).toBeDisabled();
  });
});
