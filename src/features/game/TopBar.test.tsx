import { cleanup, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { type BlindLevel } from '@/engine';

import { LEVEL_LENGTH_MS } from './pacing';
import { TopBar } from './TopBar';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const LEVELS: readonly BlindLevel[] = [
  { smallBlind: 10, bigBlind: 20 },
  { smallBlind: 15, bigBlind: 30 },
  { smallBlind: 20, bigBlind: 40 },
];

const setupUser = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

/** Epoch ms the session began, from whatever the fake clock is showing. */
const startedAt = (agoMs = 0): number => Date.now() - agoMs;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('TopBar', () => {
  it('shows how long the session has been running', async () => {
    await render(
      <TopBar
        mode="learning"
        startedAt={startedAt(9_514_000)}
        levels={LEVELS}
        guided
        onToggleGuided={jest.fn()}
        onLeave={jest.fn()}
      />,
    );

    expect(screen.getByText('158:34')).toBeOnTheScreen();
  });

  it('opens the review sheet from the corner', async () => {
    const user = setupUser();

    await render(
      <TopBar
        mode="learning"
        startedAt={startedAt()}
        levels={LEVELS}
        guided
        onToggleGuided={jest.fn()}
        onLeave={jest.fn()}
      />,
    );
    await user.press(screen.getByLabelText('Review this session'));

    expect(router.push).toHaveBeenCalledWith('/game/review');
  });

  it('counts down to the blinds coming next, in real mode only', async () => {
    const { rerender } = await render(
      <TopBar
        mode="real"
        startedAt={startedAt(125_000)}
        levels={LEVELS}
        guided
        onToggleGuided={jest.fn()}
        onLeave={jest.fn()}
      />,
    );

    // Fifty-five seconds of a three-minute level left, and the stakes that arrive
    // when it runs out — not the ones being played now.
    expect(screen.getByText('in 0:55')).toBeOnTheScreen();
    expect(screen.getByText('15 - 30')).toBeOnTheScreen();
    expect(screen.queryByText('10 - 20')).not.toBeOnTheScreen();

    await rerender(
      <TopBar
        mode="learning"
        startedAt={startedAt(125_000)}
        levels={LEVELS}
        guided
        onToggleGuided={jest.fn()}
        onLeave={jest.fn()}
      />,
    );

    // Learning stays at one level forever, so there is nothing to count down to.
    expect(screen.queryByText(/^in /)).not.toBeOnTheScreen();
  });

  it('stops counting down once the ladder has run out', async () => {
    await render(
      <TopBar
        mode="real"
        startedAt={startedAt(LEVEL_LENGTH_MS * 5)}
        levels={LEVELS}
        guided
        onToggleGuided={jest.fn()}
        onLeave={jest.fn()}
      />,
    );

    // The blinds clamp at the top rung, so a countdown here would be counting down
    // to the level already being played.
    expect(screen.queryByText(/^in /)).not.toBeOnTheScreen();
  });

  it('walks away from a learning session without asking', async () => {
    const user = setupUser();
    const onLeave = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await render(
      <TopBar
        mode="learning"
        startedAt={startedAt()}
        levels={LEVELS}
        guided
        onToggleGuided={jest.fn()}
        onLeave={onLeave}
      />,
    );
    await user.press(screen.getByLabelText('Leave the table'));

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it('asks before abandoning a real session, and only leaves if told to', async () => {
    const user = setupUser();
    const onLeave = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await render(
      <TopBar
        mode="real"
        startedAt={startedAt()}
        levels={LEVELS}
        guided
        onToggleGuided={jest.fn()}
        onLeave={onLeave}
      />,
    );
    await user.press(screen.getByLabelText('Leave the table'));

    expect(onLeave).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);

    // Real mode has a clock and no rebuys, so leaving ends the session for good;
    // confirming is what actually does it.
    const buttons = alert.mock.calls[0]?.[2] ?? [];

    buttons.find((button) => button.style === 'destructive')?.onPress?.();

    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
