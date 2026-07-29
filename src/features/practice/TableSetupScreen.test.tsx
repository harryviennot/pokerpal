import { cleanup, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { DEFAULT_SETUP } from './tableSetup';
import { TableSetupScreen } from './TableSetupScreen';
import { usePracticeStore } from './usePracticeStore';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const SEED = 20260728;

beforeEach(() => {
  usePracticeStore.getState().configure(DEFAULT_SETUP, SEED);
});

afterEach(async () => {
  await cleanup();
});

describe('TableSetupScreen', () => {
  it('names every opponent and the archetype they play', async () => {
    await render(<TableSetupScreen />);

    expect(screen.getByText('Ava')).toBeOnTheScreen();
    expect(screen.getByText('The TAG')).toBeOnTheScreen();
    expect(screen.getByText('The Calling Station')).toBeOnTheScreen();
    expect(screen.getByText(/closest thing to a real game/)).toBeOnTheScreen();
  });

  it('says how deep the table plays', async () => {
    await render(<TableSetupScreen />);

    // 1 000 chips at 5/10 is a hundred big blinds.
    expect(screen.getByText('100 big blinds')).toBeOnTheScreen();
  });

  it('warns that starting a table ends the session', async () => {
    await render(<TableSetupScreen />);

    expect(screen.getByText(/ends the session you are in/)).toBeOnTheScreen();
  });

  it('seats the new table and closes itself', async () => {
    const user = userEvent.setup();

    await render(<TableSetupScreen />);
    await user.press(screen.getByLabelText('Start new table'));

    expect(router.back).toHaveBeenCalled();
    expect(usePracticeStore.getState().setup).toEqual(DEFAULT_SETUP);
    expect(usePracticeStore.getState().hand.complete).toBe(false);
  });
});
