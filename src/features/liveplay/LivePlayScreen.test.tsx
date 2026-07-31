import { act, cleanup, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { parseCard, parseCards, type Card } from '@/engine';
import { getSettingsRepo } from '@/services/settings';
import { heroPair, steadyFrames } from '@/services/vision';

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
const HERO: readonly [Card, Card] = [parseCard('Ah'), parseCard('Kh')];

const read = () => useLivePlayStore.getState();

async function acknowledgeEthics(): Promise<void> {
  await (await getSettingsRepo()).set(ETHICS_SETTING_KEY, 'true');
}

/** Plays frames the way the frame processor would: one at a time. */
async function feed(cards: Parameters<typeof steadyFrames>[0], count: number): Promise<void> {
  await act(async () => {
    for (const frame of steadyFrames(cards, count)) {
      read().ingestFrame(frame);
    }
  });
}

/** Opens the screen past the gate, with the camera already watching. */
async function openWatching(): Promise<void> {
  await acknowledgeEthics();
  await render(<LivePlayScreen />);
  await waitFor(() => expect(screen.getByText('Your hand')).toBeOnTheScreen());
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

    expect(screen.getByText('Your hand')).toBeOnTheScreen();
  });

  it('skips the gate when the acknowledgement is already stored', async () => {
    await openWatching();

    expect(screen.queryByText(/banned in casinos/i)).not.toBeOnTheScreen();
  });

  it('starts watching with no setup step, and locks the flop the camera saw', async () => {
    await openWatching();

    expect(screen.getByText(/Watching for the flop/)).toBeOnTheScreen();

    await feed(FLOP, DEFAULT_FUSION.lockHits);

    expect(screen.getByLabelText(/Board card Q♣/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/Board card 7♦/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/Board card 2♠/)).toBeOnTheScreen();
    expect(screen.getByText('Flop')).toBeOnTheScreen();
  });

  it('reads the hero pair off the table without a single tap', async () => {
    await openWatching();

    expect(screen.getByText(/Point the camera at the table/)).toBeOnTheScreen();

    await feed([...heroPair(HERO)], DEFAULT_FUSION.lockHits);

    expect(screen.getByLabelText(/Your A♥/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/Your K♥/)).toBeOnTheScreen();
    expect(screen.getByText('Read from the table')).toBeOnTheScreen();
    expect(read().heroSource).toBe('vision');
  });

  it('recommends an action once the cards are read and the price is tapped in', async () => {
    await openWatching();

    await feed([...heroPair(HERO)], DEFAULT_FUSION.lockHits);
    await feed(FLOP, DEFAULT_FUSION.lockHits);

    await act(async () => read().setPotEntry({ pot: 10, toCall: 2 }));
    await act(async () => {
      jest.advanceTimersByTime(20);
    });

    await waitFor(() => expect(screen.getByLabelText(/^Advice:/)).toBeOnTheScreen());
    expect(screen.getByText(/needed to call/)).toBeOnTheScreen();
  });

  it('lets the player correct a card the camera misread', async () => {
    const user = userEvent.setup();

    await openWatching();
    await feed([...heroPair(HERO)], DEFAULT_FUSION.lockHits);

    await user.press(screen.getByLabelText(/Your K♥/));

    expect(screen.getByText('What is that card really?')).toBeOnTheScreen();

    await user.press(screen.getByLabelText('Rank Q'));
    await user.press(screen.getByLabelText('Suit spades'));

    expect(read().heroCards).toEqual([HERO[0], parseCard('Qs')]);
    expect(screen.getByText('Entered by you')).toBeOnTheScreen();
  });

  it('offers the hand-over screen at the boundary and starts the next hand clean', async () => {
    const user = userEvent.setup();

    await openWatching();
    await feed([...heroPair(HERO)], DEFAULT_FUSION.lockHits);
    await feed(FLOP, DEFAULT_FUSION.lockHits);

    await act(async () => read().endHand());

    expect(screen.getByText('Hand over')).toBeOnTheScreen();

    await user.press(screen.getByLabelText('Next hand'));

    expect(read().handsObserved).toBe(1);
    expect(read().heroCards).toBeNull();
    expect(screen.getByText('Your hand')).toBeOnTheScreen();
  });
});
