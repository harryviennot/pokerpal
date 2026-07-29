import { cleanup, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { legalActions } from '@/engine';

import { TableScreen } from './TableScreen';
import { usePracticeStore } from './usePracticeStore';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const setupUser = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

/** The table these assertions were written against. */
const SEED = 20260728;

beforeEach(() => {
  jest.useFakeTimers();
  // A fixed seed: these assertions name the cards the table was dealt, and
  // the store's own default is the clock so a session is never replayed by
  // accident.
  usePracticeStore.getState().reset(SEED);
});

afterEach(async () => {
  await cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('TableScreen', () => {
  it('opens with the hero on the clock', async () => {
    await render(<TableScreen />);

    expect(screen.getByLabelText('Fold')).toBeOnTheScreen();
    expect(screen.getByLabelText('Call 10')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Raise to/)).toBeOnTheScreen();
  });

  it('seats the table with the hero face up and everyone else face down', async () => {
    await render(<TableScreen />);

    expect(screen.getByLabelText('You, 1 000 behind')).toBeOnTheScreen();
    expect(screen.getByLabelText('Dealer button')).toBeOnTheScreen();

    // Two cards per opponent still in the hand — the archetypes fold plenty
    // preflop, and a folded seat has no cards to show face down.
    const faceDown = screen.getAllByLabelText('Face-down card').length;

    expect(faceDown).toBeGreaterThanOrEqual(2);
    expect(faceDown % 2).toBe(0);
  });

  it('offers no controls the rules did not', async () => {
    await render(<TableScreen />);

    // Checking is not legal facing the big blind.
    expect(screen.queryByLabelText('Check')).not.toBeOnTheScreen();
  });

  /**
   * The arithmetic behind the presets is `potRaiseTo`, and it is pinned to exact
   * numbers in the engine's own tests. What matters here is the wiring: that the
   * presets are ordered, that they land on the button, and that none of them can
   * leave the legal band however the bots happened to act.
   */
  it('opens the raise at the minimum the rules allow', async () => {
    await render(<TableScreen />);

    const raise = legalActions(usePracticeStore.getState().hand).find(
      (action) => action.type === 'bet' || action.type === 'raise',
    );

    expect(raise).toBeDefined();
    expect(
      screen.getByLabelText(`Raise to ${raise?.type === 'raise' ? raise.min : 0}`),
    ).toBeOnTheScreen();
  });

  it('sizes the presets in order and never outside the legal band', async () => {
    const user = setupUser();

    await render(<TableScreen />);

    const raise = legalActions(usePracticeStore.getState().hand).find(
      (action) => action.type === 'raise',
    );
    const sizes: number[] = [];

    for (const preset of ['½ pot', '¾ pot', 'Pot', 'All in']) {
      await user.press(screen.getByLabelText(preset));

      const label = screen.getByLabelText(/^Raise to /).props.accessibilityLabel as string;

      sizes.push(Number(label.replace(/\D/g, '')));
    }

    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(raise?.min ?? 0);
    expect(Math.max(...sizes)).toBe(raise?.max);
  });

  it('plays the hero decision and moves the hand on', async () => {
    const user = setupUser();

    await render(<TableScreen />);
    await user.press(screen.getByLabelText('Call 10'));

    expect(usePracticeStore.getState().hand.events.length).toBeGreaterThan(0);
    expect(screen.getByText(/^Flop ·/)).toBeOnTheScreen();
  });

  it('shows the result and the way on once the hand is over', async () => {
    const user = setupUser();

    await render(<TableScreen />);
    await user.press(screen.getByLabelText('Fold'));

    expect(screen.getByLabelText('Next hand')).toBeOnTheScreen();
    // The hero folded on the button, having posted nothing.
    expect(screen.getByText('No chips changed hands')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Fold')).not.toBeOnTheScreen();
  });

  it('deals another hand on request', async () => {
    const user = setupUser();

    await render(<TableScreen />);
    await user.press(screen.getByLabelText('Fold'));
    await user.press(screen.getByLabelText('Next hand'));

    expect(usePracticeStore.getState().session.handsPlayed).toBe(1);
    expect(screen.getByLabelText('Fold')).toBeOnTheScreen();
  });

  it('grades the hand once it is over', async () => {
    const user = setupUser();

    await render(<TableScreen />);
    await user.press(screen.getByLabelText('Fold'));

    // Folding the button preflop is graded, and the note names the price and
    // the equity rather than an opinion.
    expect(screen.getByText(/Folded/)).toBeOnTheScreen();
    expect(screen.getByText(/equity/)).toBeOnTheScreen();
  });

  it('opens the session review from the coach note', async () => {
    const user = setupUser();

    await render(<TableScreen />);
    await user.press(screen.getByLabelText('Fold'));
    await user.press(screen.getByLabelText(/Folded/));

    expect(router.push).toHaveBeenCalledWith('/table/review');
  });

  it('says nothing about a hand still in progress', async () => {
    await render(<TableScreen />);

    expect(screen.queryByText(/equity/)).not.toBeOnTheScreen();
  });

  it('captions the hero hand while it is live and banners the winner after', async () => {
    const user = setupUser();

    await render(<TableScreen />);

    // Preflop the caption reads the hole cards alone: a pocket pair or a high card.
    expect(screen.getByText(/^(Pair of|.+ high$)/)).toBeOnTheScreen();

    await user.press(screen.getByLabelText('Fold'));

    // The hero folded, so somebody else took the pot without a showdown.
    expect(screen.getByText(/wins/)).toBeOnTheScreen();
    expect(screen.queryByText(/^(Pair of|.+ high$)/)).not.toBeOnTheScreen();
  });

  it('steps back through the hand once it is finished', async () => {
    const user = setupUser();

    await render(<TableScreen />);
    await user.press(screen.getByLabelText('Fold'));

    const live = screen.getByText(/of \d+$/).props.children.join('');

    await user.press(screen.getByLabelText('Restart the hand'));

    expect(screen.getByText('Hand #1 begins, button on You')).toBeOnTheScreen();
    expect(screen.getByText(/of \d+$/).props.children.join('')).not.toBe(live);
  });
});
