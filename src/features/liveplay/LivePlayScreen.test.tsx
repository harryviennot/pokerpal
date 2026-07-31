import { act, cleanup, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { parseCards } from '@/engine';
import { getSettingsRepo } from '@/services/settings';
import { steadyFrames } from '@/services/vision';

import { DEFAULT_FUSION } from './fusion';
import { LivePlayScreen } from './LivePlayScreen';
import { ETHICS_SETTING_KEY } from './useEthicsAcknowledgement';
import { useLivePlayStore } from './useLivePlayStore';

// The camera view's focus effect needs a navigator; under Jest "focused once"
// is an effect, same as the history screen's mock.
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

const FLOP = parseCards('Qc 7d 2s');

const read = () => useLivePlayStore.getState();

async function acknowledgeEthics(): Promise<void> {
  await (await getSettingsRepo()).set(ETHICS_SETTING_KEY, 'true');
}

/** Locks a flop the way the frame processor would: one frame at a time. */
async function feedFlop(): Promise<void> {
  await act(async () => {
    for (const frame of steadyFrames(FLOP, DEFAULT_FUSION.lockHits)) {
      read().ingestFrame(frame);
    }
  });
}

async function pickHeroCards(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.press(screen.getByLabelText('Rank A'));
  await user.press(screen.getByLabelText('Suit hearts'));
  await user.press(screen.getByLabelText('Rank K'));
  await user.press(screen.getByLabelText('Suit hearts'));
}

beforeEach(() => {
  jest.useFakeTimers();
  read().reset();
});

afterEach(async () => {
  await cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('LivePlayScreen', () => {
  it('shows the intended-use gate first, and never again once acknowledged', async () => {
    const user = userEvent.setup();

    await render(<LivePlayScreen />);

    await waitFor(() => expect(screen.getByText(/banned in casinos/i)).toBeOnTheScreen());

    await user.press(screen.getByLabelText('I understand'));

    expect(screen.getByText('Your cards')).toBeOnTheScreen();
  });

  it('skips the gate when the acknowledgement is already stored', async () => {
    await acknowledgeEthics();
    await render(<LivePlayScreen />);

    await waitFor(() => expect(screen.getByText('Your cards')).toBeOnTheScreen());
    expect(screen.queryByText(/banned in casinos/i)).not.toBeOnTheScreen();
  });

  it('walks two taps of setup into watching, and locks the flop the camera saw', async () => {
    const user = userEvent.setup();

    await acknowledgeEthics();
    await render(<LivePlayScreen />);
    await waitFor(() => expect(screen.getByText('Your cards')).toBeOnTheScreen());

    await pickHeroCards(user);
    await user.press(screen.getByLabelText('Start watching'));

    expect(screen.getByText(/Watching for the flop/)).toBeOnTheScreen();

    await feedFlop();

    expect(screen.getByLabelText(/Board card Q♣/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/Board card 7♦/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/Board card 2♠/)).toBeOnTheScreen();
    expect(screen.getByText('Flop')).toBeOnTheScreen();
  });

  it('recommends an action once the price is tapped in', async () => {
    const user = userEvent.setup();

    await acknowledgeEthics();
    await render(<LivePlayScreen />);
    await waitFor(() => expect(screen.getByText('Your cards')).toBeOnTheScreen());
    await pickHeroCards(user);
    await user.press(screen.getByLabelText('Start watching'));

    await feedFlop();
    await act(async () => read().setPotEntry({ pot: 10, toCall: 2 }));

    await act(async () => {
      jest.advanceTimersByTime(20);
    });

    await waitFor(() => expect(screen.getByLabelText(/^Advice:/)).toBeOnTheScreen());
    expect(screen.getByText(/needed to call/)).toBeOnTheScreen();
  });

  it('offers the hand-over screen at the boundary and starts the next hand clean', async () => {
    const user = userEvent.setup();

    await acknowledgeEthics();
    await render(<LivePlayScreen />);
    await waitFor(() => expect(screen.getByText('Your cards')).toBeOnTheScreen());
    await pickHeroCards(user);
    await user.press(screen.getByLabelText('Start watching'));

    await feedFlop();
    await act(async () => read().endHand());

    expect(screen.getByText('Hand over')).toBeOnTheScreen();

    await user.press(screen.getByLabelText('Next hand'));

    expect(screen.getByText('Next hand')).toBeOnTheScreen();
    expect(read().handsObserved).toBe(1);
  });
});
