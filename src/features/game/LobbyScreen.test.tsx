import { cleanup, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { LobbyScreen } from './LobbyScreen';
import { DEFAULT_GAME_SETUP } from './tableSetup';
import { useGameStore } from './useGameStore';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const read = () => useGameStore.getState();

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  // No game and the default table: what the lobby looks like on a cold launch.
  read().leave();
  useGameStore.setState({ setup: DEFAULT_GAME_SETUP });
});

afterEach(async () => {
  await cleanup();
  // A session started by a test is still pumping; leaving cancels its timers.
  read().leave();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('LobbyScreen', () => {
  it('names every opponent and the archetype they play', async () => {
    await render(<LobbyScreen />);

    expect(screen.getByText('Ava')).toBeOnTheScreen();
    expect(screen.getByText('The TAG')).toBeOnTheScreen();
    expect(screen.getByText('The Calling Station')).toBeOnTheScreen();
    expect(screen.getByText(/closest thing to a real game/)).toBeOnTheScreen();
  });

  it('says how deep the table plays', async () => {
    await render(<LobbyScreen />);

    // 1 000 chips at 5/10 is a hundred big blinds.
    expect(screen.getByText('100 big blinds')).toBeOnTheScreen();
  });

  it('explains both games so the choice can be made before playing one', async () => {
    await render(<LobbyScreen />);

    expect(screen.getByLabelText('Learning')).toBeOnTheScreen();
    expect(screen.getByLabelText('Real game')).toBeOnTheScreen();
    expect(screen.getByText(/take as long as you like/i)).toBeOnTheScreen();
    expect(screen.getByText(/20 seconds to act/)).toBeOnTheScreen();
    expect(screen.getByText(/No equity, no pot odds/)).toBeOnTheScreen();
  });

  it('starts in learning mode, which is the store default', async () => {
    await render(<LobbyScreen />);

    expect(screen.getByLabelText('Learning')).toBeSelected();
    expect(screen.getByLabelText('Real game')).not.toBeSelected();
    expect(screen.getByLabelText('Start learning')).toBeOnTheScreen();
  });

  it('offers the rebuy toggle in a learning cash game', async () => {
    await render(<LobbyScreen />);

    expect(screen.queryByText(/Nobody rebuys in a real game/)).not.toBeOnTheScreen();
  });

  it('says what choosing a real game changes rather than ignoring the input', async () => {
    const user = userEvent.setup();

    await render(<LobbyScreen />);
    await user.press(screen.getByLabelText('Real game'));

    expect(screen.getByLabelText('Real game')).toBeSelected();
    // The chosen stake is the bottom of the ladder `blindLadder` builds.
    expect(screen.getByText(/They climb every 3 minutes: 5 \/ 10/)).toBeOnTheScreen();
    expect(screen.getByText(/Nobody rebuys in a real game/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Start real game')).toBeOnTheScreen();
  });

  it('seats a real game and opens the felt over the tabs', async () => {
    const user = userEvent.setup();

    await render(<LobbyScreen />);
    await user.press(screen.getByLabelText('Real game'));
    await user.press(screen.getByLabelText('Start real game'));

    expect(read().setup).toEqual({ ...DEFAULT_GAME_SETUP, mode: 'real' });
    expect(read().game?.mode).toBe('real');
    expect(read().game?.hand.complete).toBe(false);
    expect(router.push).toHaveBeenCalledWith('/game');
  });

  it('seats a learning game with the table on screen', async () => {
    const user = userEvent.setup();

    await render(<LobbyScreen />);
    await user.press(screen.getByLabelText('Start learning'));

    expect(read().game?.mode).toBe('learning');
    expect(read().setup.rebuys).toBe(true);
    expect(router.push).toHaveBeenCalledWith('/game');
  });

  it('keeps the last table used, so the next session is one tap away', async () => {
    useGameStore.setState({ setup: { ...DEFAULT_GAME_SETUP, opponents: 2, mode: 'real' } });

    await render(<LobbyScreen />);

    expect(screen.getByLabelText('Real game')).toBeSelected();
    expect(screen.getByText('Ben')).toBeOnTheScreen();
    expect(screen.queryByText('Cleo')).not.toBeOnTheScreen();
  });

  it('offers a way back into a session already in progress', async () => {
    const user = userEvent.setup();

    read().start(DEFAULT_GAME_SETUP, 20260728);

    await render(<LobbyScreen />);

    expect(screen.getByText('STILL PLAYING')).toBeOnTheScreen();
    expect(screen.getByText(/ends the game you are in/)).toBeOnTheScreen();

    await user.press(screen.getByLabelText('Back to your game'));

    expect(router.push).toHaveBeenCalledWith('/game');
    // Rejoining must not touch the session it is rejoining.
    expect(read().game?.session.handsPlayed).toBe(0);
  });

  it('says nothing about a session in progress when there is none', async () => {
    await render(<LobbyScreen />);

    expect(screen.queryByText('STILL PLAYING')).not.toBeOnTheScreen();
    expect(screen.queryByText(/ends the game you are in/)).not.toBeOnTheScreen();
  });
});
