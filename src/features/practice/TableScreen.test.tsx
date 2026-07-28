import { cleanup, render, screen, userEvent } from '@testing-library/react-native';

import { TableScreen } from './TableScreen';
import { usePracticeStore } from './usePracticeStore';

const setupUser = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

beforeEach(() => {
  jest.useFakeTimers();
  usePracticeStore.getState().reset();
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
    expect(screen.getAllByLabelText('Face-down card')).toHaveLength(10);
    expect(screen.getByLabelText('Dealer button')).toBeOnTheScreen();
  });

  it('offers no controls the rules did not', async () => {
    await render(<TableScreen />);

    // Checking is not legal facing the big blind.
    expect(screen.queryByLabelText('Check')).not.toBeOnTheScreen();
  });

  it('opens the raise at the minimum and resizes from the presets', async () => {
    const user = setupUser();

    await render(<TableScreen />);

    expect(screen.getByLabelText('Raise to 20')).toBeOnTheScreen();

    await user.press(screen.getByLabelText('Pot'));

    // The pot is 45 — two blinds and three callers — and the hero owes 10. A
    // pot-sized raise calls that 10 and raises the 55 behind it.
    expect(screen.getByLabelText('Raise to 65')).toBeOnTheScreen();
  });

  it('sizes half pot off the pot the call has already grown', async () => {
    const user = setupUser();

    await render(<TableScreen />);
    await user.press(screen.getByLabelText('½ pot'));

    // 10 to call, then half of the 55 that leaves in the middle.
    expect(screen.getByLabelText('Raise to 38')).toBeOnTheScreen();
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
