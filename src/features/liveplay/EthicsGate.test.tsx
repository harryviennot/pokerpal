import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import { getSettingsRepo } from '@/services/settings';

import { EthicsGate } from './EthicsGate';
import { ETHICS_SETTING_KEY, useEthicsAcknowledgement } from './useEthicsAcknowledgement';

afterEach(async () => {
  await cleanup();
});

describe('EthicsGate', () => {
  it('states the intended use and what using it otherwise means', async () => {
    await render(<EthicsGate onAccept={jest.fn()} />);

    expect(screen.getByText(/training tool/i)).toBeOnTheScreen();
    expect(screen.getByText(/banned in casinos/i)).toBeOnTheScreen();
    expect(screen.getByText(/cheating/i)).toBeOnTheScreen();
  });

  it('commits on the single acknowledgement', async () => {
    const onAccept = jest.fn();
    const user = userEvent.setup();

    await render(<EthicsGate onAccept={onAccept} />);
    await user.press(screen.getByLabelText('I understand'));

    expect(onAccept).toHaveBeenCalledTimes(1);
  });
});

describe('useEthicsAcknowledgement', () => {
  it('asks the first time, and persists so it never asks again', async () => {
    const first = await renderHook(() => useEthicsAcknowledgement());

    await waitFor(() => expect(first.result.current.status).toBe('needed'));

    await act(async () => first.result.current.accept());

    expect(first.result.current.status).toBe('accepted');
    await waitFor(async () =>
      expect(await (await getSettingsRepo()).get(ETHICS_SETTING_KEY)).toBe('true'),
    );

    // A fresh mount — the next app launch — reads the stored flag.
    const second = await renderHook(() => useEthicsAcknowledgement());

    await waitFor(() => expect(second.result.current.status).toBe('accepted'));
  });
});
